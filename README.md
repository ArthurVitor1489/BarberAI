# 💈 BarberAI — Plataforma SaaS de Barbearia com Chatbot Inteligente (Gemini AI)

O **BarberAI** é um ecossistema SaaS de ponta para gestão e atendimento automatizado de barbearias premium. Ele combina um **painel administrativo moderno em Next.js** para acompanhamento comercial e métricas do salão com um **agente de atendimento em NestJS integrado ao WhatsApp** que realiza o agendamento completo, cancelamento e remarcação de serviços de forma 100% autônoma e gratuita usando **Google Gemini 2.5 Flash**.

---

## 🚀 Principais Funcionalidades

### 💬 Chatbot Autônomo & Function Calling (Agente de IA)
* **Atendimento Humanizado**: O robô responde em português natural, usando emojis, chamando o cliente pelo nome e consultando o histórico para gerar identificação imediata.
* **Execução de Ferramentas (Function Calling)**: A IA não apenas responde dúvidas; ela invoca funções do sistema (tools) para ler barbeiros ativos, conferir serviços, buscar horários livres no banco de dados e criar/cancelar/remarcar agendamentos em tempo real.
* **Handoff Humano**: Caso o cliente solicite falar com um atendente ou a IA enfrente uma situação complexa, o transbordo humano é ativado no banco de dados, silenciando a IA para que a equipe humana assuma.

### 🏢 Arquitetura SaaS Multi-Tenant
* **Isolamento de Dados**: Todo o banco de dados é modelado para isolar múltiplos salões (tenants). Clientes, barbeiros, serviços e agendas são restritos ao escopo de cada barbearia.
* **Roteamento Dinâmico de Webhooks**: Mensagens vindas do WhatsApp são roteadas automaticamente para a barbearia correspondente a partir da instância Evolution API cadastrada.

### 📊 Painel Administrativo & Analytics (Product Analytics)
* **Funil de Conversão Comercial**: Visualização em tempo real de clientes que iniciaram contato vs. agendaram.
* **Métricas do Piloto**: ROI estimado, taxa de no-show, taxa de autonomia da IA e NPS (Net Promoter Score) geral de satisfação do usuário.
* **Widget de Feedback Integrado**: Coleta estruturada de feedbacks sobre a qualidade do dashboard, IA, suporte e agenda.

### 🕒 Resiliência a Fusos Horários (Timezone-Aware)
* Conversão dinâmica de fusos horários locais para UTC ingênuo. Previne bugs clássicos de timezone na validação de agendamentos no passado ou listagem de vagas de hoje.

---

## 🛠️ Tecnologias Utilizadas

### **Backend (`barber-whatsapp-service`)**
* **Framework**: NestJS (Node.js)
* **ORM**: Prisma 7 (com PostgreSQL Adapter)
* **Banco de Dados**: PostgreSQL (banco de dados transacional)
* **Cache & Filas**: Redis (com fallback automático em memória)
* **API de IA**: Google Gemini 2.5 Flash (via camada de compatibilidade OpenAI SDK)
* **Integração WhatsApp**: Evolution API v2 (via Webhooks e REST)

### **Frontend (`barber-admin-web`)**
* **Framework**: Next.js 16 (App Router / Turbopack)
* **Estilização**: Vanilla CSS (tokens de design consistentes, dark mode premium e micro-animações)
* **Gerenciamento de Estado**: React Query (TanStack Query)
* **Gráficos**: Recharts (visualização dinâmica do Funil e ROI)

---

## 📐 Arquitetura de Integração

```mermaid
graph TD
    Client[WhatsApp Client] -->|Envia Mensagem| Evolution[Evolution API]
    Evolution -->|Webhook: messages.upsert| Nest[NestJS Backend]
    Nest -->|Busca Contexto e Histórico| DB[(PostgreSQL)]
    Nest -->|Envia Histórico + Contexto + Tools| Gemini[Google Gemini 2.5 Flash]
    Gemini -->|Retorna Tool Call: Listar/Criar| Nest
    Nest -->|Executa Ação no Banco| DB
    Nest -->|Retorna Resultado da Ação| Gemini
    Gemini -->|Gera Resposta Final| Nest
    Nest -->|Envia Mensagem de Resposta| Evolution
    Evolution -->|Entrega Mensagem| Client
    
    Admin[Dono / Staff] -->|Visualiza Dashboard & Conversas| NextJS[NextJS Frontend]
    NextJS -->|Consome APIs| Nest
```

---

## ⚡ Como Rodar o Projeto Localmente

### 1. Pré-requisitos
* Node.js (v18+)
* Banco PostgreSQL rodando
* Chave API gratuita obtida no [Google AI Studio](https://aistudio.google.com/)

### 2. Configurando o Backend (`barber-whatsapp-service`)

1. Entre na pasta do backend e instale as dependências:
   ```bash
   cd barber-whatsapp-service
   npm install
   ```

2. Crie e configure o arquivo `.env` na raiz do backend:
   ```env
   DATABASE_URL="postgres://usuario:senha@localhost:5432/nomedobanco"
   PORT=3000
   JWT_SECRET="super-secret-key-12345!"
   GEMINI_API_KEY="SUA_CHAVE_GEMINI_AQUI"
   ```

3. Sincronize o schema do Prisma com o banco de dados e popule com o seed de teste:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
   *(O seed criará a Barbearia Clássica Piloto, barbeiros Bruno e Carlos, serviços degradê/barba e o cliente Ricardo Humano)*

4. Execute o backend em modo de desenvolvimento:
   ```bash
   npm run start:dev
   ```

### 3. Configurando o Frontend (`barber-admin-web`)

1. Entre na pasta do frontend e instale as dependências:
   ```bash
   cd ../barber-admin-web
   npm install
   ```

2. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev -- -p 3001
   ```
   Acesse o painel em `http://localhost:3001`.

---

## 🧪 Como Simular e Testar Conversas via CLI

Para fins de teste e demonstração rápida do chatbot sem precisar de um chip de WhatsApp ativo, fornecemos um **simulador de mensagens CLI** na pasta do backend (`barber-whatsapp-service`):

1. **Simular primeiro contato de um novo cliente**:
   ```bash
   node simulate-message.js "Olá, gostaria de agendar um corte com o Bruno hoje às 14:00" "5511999999999" "Arthur Vitor"
   ```
   *O sistema criará automaticamente o cliente "Arthur Vitor" e o chatbot responderá solicitando qual tipo de corte deseja.*

2. **Escolher o serviço e fechar o agendamento**:
   ```bash
   node simulate-message.js "Corte degradê" "5511999999999" "Arthur Vitor"
   ```
   *O chatbot executará o Function Calling `criarAgendamento` no banco de dados e enviará a confirmação com o checkmark (`✅`).*

3. **Ver o histórico da conversa no terminal**:
   ```bash
   node print-gemini-response.js 5511999999999
   ```
   *Exibe as últimas mensagens trocadas com o cliente simulado no banco de dados.*

4. **Ver no Dashboard**:
   Acesse a aba **Conversas** no painel administrativo em `http://localhost:3001` para ver a conversa de Arthur Vitor em tempo real.

---

## 📜 Licença
Este projeto é licenciado sob a [MIT License](LICENSE).
