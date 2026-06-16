import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Clearing existing database...');
  await prisma.aIEscalationReason.deleteMany({});
  await prisma.feedback.deleteMany({});
  await prisma.usageLog.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.workingHours.deleteMany({});
  await prisma.barber.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.whatsAppInstance.deleteMany({});
  await prisma.barbershop.deleteMany({});

  console.log('Seeding pilot barbershop data...');

  const barbershop = await prisma.barbershop.create({
    data: {
      name: 'Barbearia Clássica Piloto',
      slug: 'barbearia-piloto',
      phone: '5511999999999',
      email: 'contato@barbeariapiloto.com',
      address: 'Rua dos Barbeiros, 123 - Centro',
      workingHours: '09:00-19:00',
      timezone: 'America/Sao_Paulo',
    },
  });

  await prisma.subscription.create({
    data: {
      barbershopId: barbershop.id,
      plan: 'PREMIUM_AI',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
    },
  });

  await prisma.whatsAppInstance.create({
    data: {
      instanceName: 'barbearia-piloto-wa',
      status: 'CONNECTED',
      barbershopId: barbershop.id,
    },
  });

  const hashedPassword = await bcrypt.hash('senha123', 10);

  const owner = await prisma.user.create({
    data: {
      name: 'Arthur Proprietário',
      email: 'arthur@barberai.com',
      password: hashedPassword,
      role: 'OWNER',
      barbershopId: barbershop.id,
    },
  });

  const barberUser = await prisma.user.create({
    data: {
      name: 'Bruno Barbeiro',
      email: 'bruno@barberai.com',
      password: hashedPassword,
      role: 'BARBER',
      barbershopId: barbershop.id,
    },
  });

  // Barbeiros
  const barberBruno = await prisma.barber.create({
    data: {
      name: 'Bruno Barbeiro',
      specialty: 'Cortes Clássicos e Degradê',
      barbershopId: barbershop.id,
    },
  });

  const barberCarlos = await prisma.barber.create({
    data: {
      name: 'Carlos Barbeiro',
      specialty: 'Barbas e Tratamento Facial',
      barbershopId: barbershop.id,
    },
  });

  // Working Hours para os barbeiros
  for (let day = 1; day <= 6; day++) {
    await prisma.workingHours.create({
      data: { barberId: barberBruno.id, dayOfWeek: day, startTime: '09:00', endTime: '18:00' },
    });
    await prisma.workingHours.create({
      data: { barberId: barberCarlos.id, dayOfWeek: day, startTime: '10:00', endTime: '19:00' },
    });
  }

  // Serviços
  const serviceDegrade = await prisma.service.create({
    data: {
      name: 'Corte Degradê',
      description: 'Corte moderno com transição suave nas laterais',
      price: 50.00,
      durationMinutes: 45,
      barbershopId: barbershop.id,
    },
  });

  const serviceBarba = await prisma.service.create({
    data: {
      name: 'Barba Completa',
      description: 'Alinhamento com toalha quente e navalha',
      price: 35.00,
      durationMinutes: 30,
      barbershopId: barbershop.id,
    },
  });

  const serviceCombo = await prisma.service.create({
    data: {
      name: 'Corte e Barba',
      description: 'Combo completo de cabelo e barba',
      price: 75.00,
      durationMinutes: 75,
      barbershopId: barbershop.id,
    },
  });

  // Clientes e Histórico (Funil e No-shows)
  console.log('Seeding clients, appointments, messages...');

  // Cliente 1: Iniciou conversa mas não qualificou
  const client1 = await prisma.client.create({
    data: { name: 'João Curioso', phone: '5511911111111', barbershopId: barbershop.id },
  });
  const conv1 = await prisma.conversation.create({
    data: { customerId: client1.id, barbershopId: barbershop.id, status: 'CLOSED' },
  });
  await prisma.message.create({
    data: { id: 'msg1', text: 'Olá, gostaria de saber se vocês abrem de segunda.', fromMe: false, clientId: client1.id, barbershopId: barbershop.id, conversationId: conv1.id },
  });
  await prisma.message.create({
    data: { id: 'msg1_r', text: 'Olá! Sim, funcionamos de segunda a sábado das 9h às 19h.', fromMe: true, clientId: client1.id, barbershopId: barbershop.id, conversationId: conv1.id },
  });

  // Cliente 2: Qualificado (conversou sobre preços e horários), mas não marcou
  const client2 = await prisma.client.create({
    data: { name: 'Pedro Interessado', phone: '5511922222222', barbershopId: barbershop.id },
  });
  const conv2 = await prisma.conversation.create({
    data: { customerId: client2.id, barbershopId: barbershop.id, status: 'OPEN' },
  });
  await prisma.message.create({
    data: { id: 'msg2_1', text: 'Quais os horários disponíveis para amanhã?', fromMe: false, clientId: client2.id, barbershopId: barbershop.id, conversationId: conv2.id },
  });
  await prisma.message.create({
    data: { id: 'msg2_2', text: 'Qual o preço do corte degradê?', fromMe: false, clientId: client2.id, barbershopId: barbershop.id, conversationId: conv2.id },
  });

  // Cliente 3: Convertido e Compareceu (Completed)
  const client3 = await prisma.client.create({
    data: { name: 'Diego Confirmado', phone: '5511933333333', barbershopId: barbershop.id },
  });
  const conv3 = await prisma.conversation.create({
    data: { customerId: client3.id, barbershopId: barbershop.id, status: 'CLOSED' },
  });
  await prisma.message.create({
    data: { id: 'msg3_1', text: 'Quero agendar um corte amanhã às 10h com o Bruno.', fromMe: false, clientId: client3.id, barbershopId: barbershop.id, conversationId: conv3.id },
  });
  const app3 = await prisma.appointment.create({
    data: {
      dateTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Ontem
      status: 'COMPLETED',
      clientId: client3.id,
      serviceId: serviceDegrade.id,
      barberId: barberBruno.id,
      barbershopId: barbershop.id,
      notes: '[IA] Agendado via assistente IA',
    },
  });

  // Cliente 4: Convertido e Faltou (No-Show)
  const client4 = await prisma.client.create({
    data: { name: 'Felipe Faltoso', phone: '5511944444444', barbershopId: barbershop.id },
  });
  const conv4 = await prisma.conversation.create({
    data: { customerId: client4.id, barbershopId: barbershop.id, status: 'CLOSED' },
  });
  await prisma.message.create({
    data: { id: 'msg4_1', text: 'Tem vaga para hoje às 15h?', fromMe: false, clientId: client4.id, barbershopId: barbershop.id, conversationId: conv4.id },
  });
  const app4 = await prisma.appointment.create({
    data: {
      dateTime: new Date(Date.now() - 12 * 60 * 60 * 1000), // Hoje mais cedo
      status: 'NOSHOW',
      clientId: client4.id,
      serviceId: serviceCombo.id,
      barberId: barberBruno.id,
      barbershopId: barbershop.id,
      notes: '[IA] Agendado via assistente IA',
    },
  });

  // Cliente 5: Handoff por IA não entender
  const client5 = await prisma.client.create({
    data: { name: 'Gustavo Dúvida', phone: '5511955555555', barbershopId: barbershop.id },
  });
  const conv5 = await prisma.conversation.create({
    data: { customerId: client5.id, barbershopId: barbershop.id, status: 'OPEN', handoffActive: true },
  });
  await prisma.message.create({
    data: { id: 'msg5_1', text: 'Quero fazer um procedimento de pigmentação que vi no Instagram', fromMe: false, clientId: client5.id, barbershopId: barbershop.id, conversationId: conv5.id },
  });
  await prisma.aIEscalationReason.create({
    data: {
      conversationId: conv5.id,
      reason: 'COMPLEX_REQUEST',
    },
  });

  // Cliente 6: Handoff por Reclamação
  const client6 = await prisma.client.create({
    data: { name: 'Marcos Reclamante', phone: '5511966666666', barbershopId: barbershop.id },
  });
  const conv6 = await prisma.conversation.create({
    data: { customerId: client6.id, barbershopId: barbershop.id, status: 'OPEN', handoffActive: true },
  });
  await prisma.message.create({
    data: { id: 'msg6_1', text: 'Quero falar com o gerente, o corte de ontem ficou torto!', fromMe: false, clientId: client6.id, barbershopId: barbershop.id, conversationId: conv6.id },
  });
  await prisma.aIEscalationReason.create({
    data: {
      conversationId: conv6.id,
      reason: 'COMPLAINT',
    },
  });

  // Cliente 7: Handoff por Solicitação Direta de Humano
  const client7 = await prisma.client.create({
    data: { name: 'Ricardo Humano', phone: '5511977777777', barbershopId: barbershop.id },
  });
  const conv7 = await prisma.conversation.create({
    data: { customerId: client7.id, barbershopId: barbershop.id, status: 'OPEN', handoffActive: true },
  });
  await prisma.message.create({
    data: { id: 'msg7_1', text: 'Falar com atendente humano por favor', fromMe: false, clientId: client7.id, barbershopId: barbershop.id, conversationId: conv7.id },
  });
  await prisma.aIEscalationReason.create({
    data: {
      conversationId: conv7.id,
      reason: 'HUMAN_REQUEST',
    },
  });

  // Feedbacks dos Usuários Piloto
  console.log('Seeding structured feedbacks...');
  await prisma.feedback.create({
    data: {
      comment: 'O agendamento automático via WhatsApp economizou muito tempo!',
      ratingAgenda: 5,
      ratingWhatsapp: 5,
      ratingIA: 4,
      ratingDashboard: 5,
      ratingSupport: 5,
      nps: 9,
      userId: owner.id,
      barbershopId: barbershop.id,
    },
  });

  await prisma.feedback.create({
    data: {
      comment: 'Muito bom, mas a IA às vezes se confunde com termos muito regionais.',
      ratingAgenda: 4,
      ratingWhatsapp: 4,
      ratingIA: 3,
      ratingDashboard: 4,
      ratingSupport: 4,
      nps: 8,
      userId: barberUser.id,
      barbershopId: barbershop.id,
    },
  });

  // Usage Logs
  console.log('Seeding usage logs...');
  const actions = [
    'view_dashboard',
    'view_agenda',
    'create_appointment',
    'view_conversations',
    'send_manual_message',
    'update_settings',
  ];
  for (const action of actions) {
    await prisma.usageLog.create({
      data: { action, userId: owner.id, barbershopId: barbershop.id },
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
