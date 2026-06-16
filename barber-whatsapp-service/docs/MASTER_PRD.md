# MASTER PRD — BarberAI V3 Final SaaS Multiempresa com Recepcionista IA

## 1. Visão Geral do Produto
O BarberAI V3 é uma plataforma SaaS multi-tenant robusta focada na automação de atendimento, agendamentos e CRM inteligente para barbearias. A recepcionista virtual inteligente opera de forma autônoma no WhatsApp, integrada ao banco de dados e à OpenAI, garantindo agendamentos e interações humanizadas e sem alucinações. O backend é resiliente a condições concorrentes, provê total isolamento de dados por barbearia (IDOR-safe) e conta com rastreabilidade detalhada de auditoria e telemetria em produção.

---

## 2. Tecnologias e Dependências (Stack)
* **Backend Framework**: NestJS (TypeScript)
* **Banco de Dados**: PostgreSQL + Prisma Client
* **Mensageria & Filas**: Redis + BullMQ (processamento assíncrono e relatórios)
* **Locks Distribuidos**: Redis (evitar double-booking concorrente)
* **Outbox Pattern**: Banco de dados e local EventEmitter2 para publicação garantida de eventos
* **Inteligência Artificial**: OpenAI (Modelo `gpt-4o-mini` com timeout estrito de 10s e Circuit Breaker)
* **Segurança e Throttling**: JWT + Refresh Tokens, Rate Limiting local, Ownership Guards
* **Integração WhatsApp**: Evolution API (via webhook e chamadas REST)

---

## 3. Modelo de Dados (Prisma Schema Completo)
O banco de dados do BarberAI V3 garante isolamento total por barbearia (`barbershopId`) e controle de sessões.

```prisma
model Barbershop {
  id                String             @id @default(uuid())
  name              String
  slug              String             @unique
  phone             String
  email             String
  address           String
  workingHours      String             @default("09:00-18:00")
  timezone          String             @default("America/Sao_Paulo")
  active            Boolean            @default(true)
  users             User[]
  barbers           Barber[]
  services          Service[]
  clients           Client[]
  appointments      Appointment[]
  whatsAppInstances WhatsAppInstance[]
  conversations     Conversation[]
  messages          Message[]
  dailyMetrics      DailyMetrics[]
  aiUsages          AIUsage[]
  subscription      Subscription?
  auditLogs         AuditLog[]
}

model WhatsAppInstance {
  id           String     @id @default(uuid())
  instanceName String     @unique
  instanceId   String?
  status       String     @default("DISCONNECTED")
  qrCode       String?
  barbershopId String
  barbershop   Barbershop @relation(fields: [barbershopId], references: [id], onDelete: Cascade)
}

model User {
  id           String         @id @default(uuid())
  name         String
  email        String         @unique
  password     String
  role         String         @default("OWNER") // OWNER, MANAGER, BARBER
  tokenVersion Int            @default(1) // Versão do token para invalidação global
  barbershopId String
  barbershop   Barbershop     @relation(fields: [barbershopId], references: [id], onDelete: Cascade)
  auditLogs    AuditLog[]
  sessions     Session[]
}

model Session {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  device           String   @default("Unknown")
  ip               String   @default("127.0.0.1")
  refreshTokenHash String   @unique
  createdAt        DateTime @default(now())
  lastSeenAt       DateTime @default(now())
}

model WebhookEvent {
  eventId     String   @id
  provider    String   @default("EVOLUTION_API")
  processedAt DateTime @default(now())
}

model EventOutbox {
  id          String    @id @default(uuid())
  eventType   String    // Ex: "appointment.created.v1"
  payload     String    // JSON stringificado
  status      String    @default("PENDING") // PENDING, PROCESSED, FAILED
  createdAt   DateTime  @default(now())
  processedAt DateTime?
}

model Barber {
  id           String         @id @default(uuid())
  name         String
  specialty    String
  photo        String?
  active       Boolean        @default(true)
  deletedAt    DateTime?      // Soft Delete
  barbershopId String
  barbershop   Barbershop     @relation(fields: [barbershopId], references: [id], onDelete: Cascade)
  workingHours WorkingHours[]
}

model Service {
  id              String      @id @default(uuid())
  name            String
  description     String?
  price           Float
  durationMinutes Int         @default(30)
  active          Boolean     @default(true)
  deletedAt       DateTime?   // Soft Delete
  barbershopId    String
  barbershop      Barbershop  @relation(fields: [barbershopId], references: [id], onDelete: Cascade)
}

model Client {
  id              String           @id @default(uuid())
  name            String
  phone           String
  aiEnabled       Boolean          @default(true)
  deletedAt       DateTime?        // Soft Delete
  barbershopId    String
  barbershop      Barbershop       @relation(fields: [barbershopId], references: [id], onDelete: Cascade)
}

model Appointment {
  id           String     @id @default(uuid())
  dateTime     DateTime
  status       String     @default("PENDING")
  deletedAt    DateTime?  // Soft Delete
  clientId     String
  client       Client     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  serviceId    String
  service      Service    @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  barberId     String
  barber       Barber     @relation(fields: [barberId], references: [id], onDelete: Cascade)
  barbershopId String
  barbershop   Barbershop @relation(fields: [barbershopId], references: [id], onDelete: Cascade)
  notes        String?
}
```

---

## 4. Requisitos de Fluxo e Arquitetura

### 4.1 Isolamento de Inquilinos (Multi-Tenant)
* Todas as rotas administrativas são interceptadas por um `TenantMiddleware` que valida o cabeçalho `x-barbershop-id`.
* Rotas protegidas contam com um `OwnershipGuard` que valida dinamicamente se o ID do recurso solicitado pertence à barbearia ativa na sessão (`req.user.barbershopId`), eliminando vulnerabilidades IDOR.

### 4.2 Segurança de Sessão e Autenticação
* **JWT Versioning**: O payload JWT contém um `tokenVersion`. Se o usuário alterar a senha, a `tokenVersion` é incrementada no banco, invalidando globalmente todos os tokens emitidos anteriormente.
* **Device Sessions**: Sessões ativas de dispositivos são salvas no banco. Permite listagem de sessões (`/auth/sessions`) e revogação remota (`DELETE /auth/sessions/:id`).
* **Rate Limiting**: Aplicado no fluxo de login (máximo 5 tentativas/minuto) e webhook para mitigar ataques de força bruta e abusos.

### 4.3 Resiliência Concorrente
* **Redis Distributed Locks**: Antes de criar ou remarcar um agendamento, o sistema adquire um lock distribuído no Redis correspondente a `lock:appointment:barberId:date:time`. Caso outro processo tente agendar para o mesmo barbeiro no mesmo horário ao mesmo tempo, a requisição é bloqueada e falha limpa, eliminando double-booking.
* **Webhook Idempotency**: O webhook de recepção (`/whatsapp/webhook`) valida o ID da mensagem no banco usando a tabela `WebhookEvent`. Mensagens já processadas são ignoradas de imediato, evitando dupla execução e chamadas extras de IA.

### 4.4 Event Outbox Pattern
* Modificações de estado críticas (como a criação e cancelamento de agendamentos) registram eventos versionados (`appointment.created.v1`, `appointment.cancelled.v1`) na tabela `EventOutbox` sob a mesma transação lógica da operação no banco de dados. Um serviço poller assíncrono processa essa fila local garantindo a entrega e integração.

### 4.5 Monitoramento e Observabilidade
* **Logger Estruturado**: Middleware que injeta um `requestId` por requisição HTTP e registra: `requestId`, `tenantId`, `userId`, `endpoint` e tempo de execução.
* **Métricas Telemetria**: Coletor in-memory (`MetricsService`) que expõe no endpoint `/health` o volume total de requisições, tempo médio de execução das APIs, contagem de chamadas OpenAI e falhas de rede, ajudando no diagnóstico de instabilidades.
* **Health Check Probes**: Exposição de status individual de infraestrutura em endpoints: `/health/db`, `/health/redis`, `/health/openai` e `/health` geral.
