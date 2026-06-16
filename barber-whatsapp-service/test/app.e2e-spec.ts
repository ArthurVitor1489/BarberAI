import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/database/prisma.service';
import { JwtAuthGuard } from './../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './../src/modules/auth/guards/roles.guard';
import { OwnershipGuard } from './../src/modules/auth/guards/ownership.guard';
import axios from 'axios';

// Mock do Axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock da OpenAI
const mockOpenAICreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: mockOpenAICreate,
        },
      },
    };
  });
});

describe('SaaS Multi-Tenant Webhook & Admin E2E (V2)', () => {
  let app: INestApplication<App>;
  
  // Banco em memória simulado
  let barbershops = [
    {
      id: 'tenant-barber-123',
      name: 'Barbearia Premium',
      slug: 'premium',
      phone: '5511999999999',
      email: 'contato@premium.com',
      address: 'Rua A, 123',
      workingHours: '09:00-18:00',
      timezone: 'America/Sao_Paulo',
    },
  ];

  let instances = [
    {
      id: 'inst-999',
      instanceName: 'barber_bot',
      status: 'CONNECTED',
      barbershopId: 'tenant-barber-123',
    },
  ];

  let barbers = [
    {
      id: 'barber-joao',
      name: 'João',
      specialty: 'Cabelo',
      active: true,
      barbershopId: 'tenant-barber-123',
    },
  ];

  let services = [
    {
      id: 'service-fade',
      name: 'Low Fade',
      price: 50.0,
      durationMinutes: 30,
      active: true,
      barbershopId: 'tenant-barber-123',
    },
  ];

  let clients: any[] = [];
  let appointments: any[] = [];
  let messages: any[] = [];
  let conversations: any[] = [];
  let auditLogs: any[] = [];
  let metrics: any[] = [];
  let usages: any[] = [];

  const mockPrismaService = {
    barbershop: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return barbershops.find((b) => b.id === where.id) || null;
      }),
    },
    whatsAppInstance: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return instances.find((i) => i.instanceName === where.instanceName) || null;
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        return instances.find((i) => i.barbershopId === where.barbershopId) || null;
      }),
    },
    barber: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        return barbers.filter((b) => b.barbershopId === where.barbershopId);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        return barbers.find((b) => b.id === where.id && b.barbershopId === where.barbershopId) || null;
      }),
      count: jest.fn().mockResolvedValue(1),
    },
    service: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        return services.filter((s) => s.barbershopId === where.barbershopId);
      }),
      findFirst: jest.fn().mockImplementation(({ where }) => {
        return services.find((s) => s.id === where.id && s.barbershopId === where.barbershopId) || null;
      }),
      count: jest.fn().mockResolvedValue(1),
    },
    client: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        return clients.find((c) => c.phone === where.phone && c.barbershopId === where.barbershopId) || null;
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        return clients.find((c) => c.id === where.id) || null;
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newClient = { id: `client-uuid-${Date.now()}`, aiEnabled: true, ...data };
        clients.push(newClient);
        return newClient;
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const client = clients.find((c) => c.id === where.id);
        if (client) {
          Object.assign(client, data);
          return client;
        }
        return null;
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    customerProfile: {
      findUnique: jest.fn().mockImplementation(({ where }) => null),
      create: jest.fn().mockImplementation(({ data }) => data),
    },
    conversation: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        return conversations.find((c) => c.customerId === where.customerId && c.barbershopId === where.barbershopId && c.status === 'OPEN') || null;
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newConv = { id: `conv-uuid-${Date.now()}`, handoffActive: false, status: 'OPEN', ...data };
        conversations.push(newConv);
        return newConv;
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const conv = conversations.find((c) => c.id === where.id);
        if (conv) {
          Object.assign(conv, data);
          return conv;
        }
        return null;
      }),
    },
    appointment: {
      findFirst: jest.fn().mockReturnValue(null),
      create: jest.fn().mockImplementation(({ data }) => {
        const newAppt = { id: `appt-uuid-${Date.now()}`, status: 'CONFIRMED', ...data };
        appointments.push(newAppt);
        return newAppt;
      }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockReturnValue([]),
    },
    message: {
      create: jest.fn().mockImplementation(({ data }) => {
        const newMsg = { id: `msg-uuid-${Date.now()}`, timestamp: new Date(), ...data };
        messages.push(newMsg);
        return newMsg;
      }),
      findMany: jest.fn().mockReturnValue([]),
    },
    auditLog: {
      create: jest.fn().mockImplementation(({ data }) => {
        const log = { id: `audit-uuid-${Date.now()}`, createdAt: new Date(), ...data };
        auditLogs.push(log);
        return log;
      }),
    },
    dailyMetrics: {
      upsert: jest.fn().mockImplementation(({ create }) => {
        metrics.push(create);
        return create;
      }),
    },
    aIUsage: {
      create: jest.fn().mockImplementation(({ data }) => {
        usages.push(data);
        return data;
      }),
    },
    subscription: {
      findUnique: jest.fn().mockImplementation(({ where }) => ({
        barbershopId: where.barbershopId,
        plan: 'PREMIUM_AI',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      })),
    },
    webhookEvent: {
      create: jest.fn().mockResolvedValue({ eventId: 'mock-event-id', provider: 'EVOLUTION_API' }),
    },
    eventOutbox: {
      create: jest.fn().mockImplementation(({ data }) => data),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      return callback(mockPrismaService);
    }),
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    clients = [];
    appointments = [];
    messages = [];
    conversations = [];
    auditLogs = [];
    metrics = [];
    usages = [];
    mockOpenAICreate.mockReset();
    mockedAxios.post.mockReset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { sub: 'user-123', role: 'OWNER', barbershopId: 'tenant-barber-123', tokenVersion: 1 };
          req['barbershopId'] = 'tenant-barber-123';
          return true;
        }
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OwnershipGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('deve receber webhook de uma barbearia, acionar IA com contexto de profissionais e concluir o agendamento', async () => {
    // OpenAI decide: buscar barbeiros, depois serviços, depois criar agendamento
    mockOpenAICreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call_appt_fade_99',
                  type: 'function',
                  function: {
                    name: 'criarAgendamento',
                    arguments: JSON.stringify({
                      dateTimeStr: '2026-06-16 14:00',
                      serviceId: 'service-fade',
                      barberId: 'barber-joao',
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Olá! Perfeito Arthur, seu corte de cabelo Fade foi marcado com o João para às 14:00.',
            },
          },
        ],
        usage: { prompt_tokens: 200, completion_tokens: 30 },
      });

    mockedAxios.post.mockResolvedValue({
      data: { key: { id: 'whatsapp-message-out-123' } },
    });

    const payload = {
      event: 'messages.upsert',
      instance: 'barber_bot',
      data: {
        key: {
          remoteJid: '5511888888888@s.whatsapp.net',
          fromMe: false,
          id: 'whatsapp-message-in-111',
        },
        pushName: 'Arthur',
        message: {
          conversation: 'Quero agendar um fade amanhã 14h com o João',
        },
      },
    };

    const response = await request(app.getHttpServer())
      .post('/whatsapp/webhook')
      .send(payload)
      .expect(200);

    expect(response.body).toEqual({ status: 'processed', messageId: 'whatsapp-message-in-111' });

    // Garante que o agendamento associou serviceId e barberId corretos
    expect(mockPrismaService.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          barbershopId: 'tenant-barber-123',
          serviceId: 'service-fade',
          barberId: 'barber-joao',
        }),
      }),
    );

    // Garante que gravou os custos de IA
    expect(mockPrismaService.aIUsage.create).toHaveBeenCalled();

    // Garante que gravou auditoria
    expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CREATE',
          entity: 'Appointment',
          barbershopId: 'tenant-barber-123',
        }),
      }),
    );
  });

  it('deve silenciar a IA quando o human handoff estiver ativado', async () => {
    // Cria cliente e conversa em memória com handoff ativo
    const mockClient = { id: 'client-id-handoff', phone: '5511777777777', name: 'Bruno', barbershopId: 'tenant-barber-123', aiEnabled: true };
    clients.push(mockClient);
    conversations.push({
      id: 'conv-handoff',
      customerId: mockClient.id,
      barbershopId: 'tenant-barber-123',
      status: 'OPEN',
      handoffActive: true,
    });

    const payload = {
      event: 'messages.upsert',
      instance: 'barber_bot',
      data: {
        key: {
          remoteJid: '5511777777777@s.whatsapp.net',
          fromMe: false,
          id: 'msg-handoff-99',
        },
        pushName: 'Bruno',
        message: {
          conversation: 'Alguém pode me responder?',
        },
      },
    };

    const response = await request(app.getHttpServer())
      .post('/whatsapp/webhook')
      .send(payload)
      .expect(200);

    expect(response.body).toEqual({ status: 'handoff_active_silenced', conversationId: 'conv-handoff' });

    // Verifica que a OpenAI não foi chamada
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  it('deve expor as APIs administrativas e validar o tenant header x-barbershop-id', async () => {
    // Deve falhar com 400 se o header x-barbershop-id não for fornecido
    await request(app.getHttpServer())
      .get('/dashboard')
      .expect(400);

    // Deve responder com 200 se o header estiver correto
    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('x-barbershop-id', 'tenant-barber-123')
      .expect(200);

    expect(response.body).toHaveProperty('appointmentsToday');
    expect(response.body).toHaveProperty('customers');
    expect(response.body).toHaveProperty('revenueMonth');
  });
});
