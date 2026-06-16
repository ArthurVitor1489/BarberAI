import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is not defined in environment variables.');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('Fetching database metrics for pilot report...\n');

  try {
    const barbershop = await prisma.barbershop.findFirst({
      where: { slug: 'barbearia-piloto' },
    });

    if (!barbershop) {
      console.error('Error: Pilot barbershop not found. Run the seed script first.');
      process.exit(1);
    }

    const barbershopId = barbershop.id;

    // 1. Total conversations
    const conversations = await prisma.conversation.findMany({
      where: { barbershopId },
      include: { messages: true },
    });
    const totalConversations = conversations.length;

    // 2. IA Resolution Rate
    const resolvedConversations = conversations.filter(
      (c) => c.status === 'CLOSED' && !c.handoffActive,
    ).length;
    const iaResolutionRate = totalConversations > 0 ? (resolvedConversations / totalConversations) * 100 : 0;

    // 3. Human Handoff Rate
    const handoffConversations = conversations.filter((c) => c.handoffActive).length;
    const humanHandoffRate = totalConversations > 0 ? (handoffConversations / totalConversations) * 100 : 0;

    // 4. Booking Conversion (Funnel)
    const started = totalConversations;
    const qualified = conversations.filter((c) =>
      c.messages.some((m) =>
        /agendar|corte|barba|preço|vaga|horário|marcar|valor/i.test(m.text),
      ),
    ).length;
    const converted = await prisma.appointment.count({
      where: {
        barbershopId,
        notes: { contains: '[IA]' },
        deletedAt: null,
      },
    });
    const attended = await prisma.appointment.count({
      where: {
        barbershopId,
        status: 'COMPLETED',
        deletedAt: null,
      },
    });

    const bookingConversionRate = started > 0 ? (converted / started) * 100 : 0;

    // 5. No Show Rate
    const missedCount = await prisma.appointment.count({
      where: {
        barbershopId,
        status: 'NOSHOW',
        deletedAt: null,
      },
    });
    const completedCount = attended;
    const totalConcluded = missedCount + completedCount;
    const noShowRate = totalConcluded > 0 ? (missedCount / totalConcluded) * 100 : 0;

    // 6. Time Saved (IA Messages * 2 min)
    const totalMessagesIA = await prisma.message.count({
      where: {
        barbershopId,
        fromMe: true,
        conversation: {
          handoffActive: false,
        },
      },
    });
    const hoursSaved = (totalMessagesIA * 2) / 60;

    // 7. Handoff Reasons
    const escalations = await prisma.aIEscalationReason.findMany({
      where: {
        conversation: {
          barbershopId,
        },
      },
    });
    const escalationStats = {
      HUMAN_REQUEST: escalations.filter((e) => e.reason === 'HUMAN_REQUEST').length,
      COMPLEX_REQUEST: escalations.filter((e) => e.reason === 'COMPLEX_REQUEST').length,
      NOT_UNDERSTOOD: escalations.filter((e) => e.reason === 'NOT_UNDERSTOOD').length,
      COMPLAINT: escalations.filter((e) => e.reason === 'COMPLAINT').length,
      OTHER: escalations.filter((e) => e.reason === 'OTHER').length,
    };

    // 8. Feedbacks & NPS
    const feedbacks = await prisma.feedback.findMany({
      where: { barbershopId },
    });
    const totalFeedbacks = feedbacks.length;
    const avgNps = totalFeedbacks > 0 ? feedbacks.reduce((sum, f) => sum + f.nps, 0) / totalFeedbacks : 0;

    // 9. Revenue
    const estimatedRevenue = (completedCount * 50) + (converted * 50);

    // Print Report in Markdown
    console.log(``);
    console.log(`# RELATÓRIO DIÁRIO — PILOTO 01 (Product Analytics V2)`);
    console.log(`**Barbearia:** ${barbershop.name}`);
    console.log(`**Data de Emissão:** ${new Date().toLocaleString('pt-BR')}`);
    console.log(`\n---\n`);

    console.log(`## 📊 Funil de Conversão Comercial (Booking Funnel)`);
    console.log(`| Etapa | Quantidade | Taxa de Conversão |`);
    console.log(`| :--- | :---: | :---: |`);
    console.log(`| 1. Conversas Iniciadas | ${started} | 100.0% |`);
    console.log(`| 2. Conversas Qualificadas (Interesse) | ${qualified} | ${started > 0 ? ((qualified / started) * 100).toFixed(1) : '0.0'}% |`);
    console.log(`| 3. Conversas Convertidas (Agendamento) | ${converted} | ${started > 0 ? ((converted / started) * 100).toFixed(1) : '0.0'}% |`);
    console.log(`| 4. Clientes Comparecidos (Fidelizados) | ${attended} | ${converted > 0 ? ((attended / converted) * 100).toFixed(1) : '0.0'}% |`);
    console.log(``);

    console.log(`## 🎯 Critérios de Sucesso e Métricas de Lançamento`);
    const autonomyPassed = iaResolutionRate >= 70;
    const conversionPassed = bookingConversionRate >= 50;
    const noShowPassed = noShowRate <= 10;
    const npsPassed = avgNps >= 8;

    console.log(`| Métrica | Status | Atual | Alvo Esperado |`);
    console.log(`| :--- | :---: | :---: | :---: |`);
    console.log(`| **Autonomia da IA (Resolution Rate)** | ${autonomyPassed ? '✅ Aprovado' : '⚠️ Crítico'} | ${iaResolutionRate.toFixed(1)}% | >= 70.0% |`);
    console.log(`| **Taxa de Conversão Comercial** | ${conversionPassed ? '✅ Aprovado' : '⚠️ Crítico'} | ${bookingConversionRate.toFixed(1)}% | >= 50.0% |`);
    console.log(`| **No-Show Rate (Absenteísmo)** | ${noShowPassed ? '✅ Aprovado' : '⚠️ Crítico'} | ${noShowRate.toFixed(1)}% | <= 10.0% |`);
    console.log(`| **NPS Geral de Satisfação** | ${npsPassed ? '✅ Aprovado' : '⚠️ Crítico'} | ${avgNps.toFixed(1)}/10 | >= 8.0/10 |`);
    console.log(``);

    console.log(`## 🚨 Análise de Escalabilidade e Transição para Atendimento Humano (Handoff)`);
    console.log(`- **Taxa de Transição (Handoff Rate)**: ${humanHandoffRate.toFixed(1)}% (Total de ${handoffConversations} conversas)`);
    console.log(`- **Motivos de Escalabilidade da IA**:`);
    console.log(`  - 🙋 Solicitação Humana Direta: ${escalationStats.HUMAN_REQUEST}`);
    console.log(`  - 🧩 Solicitações Complexas: ${escalationStats.COMPLEX_REQUEST}`);
    console.log(`  - ❓ Dúvidas Não Compreendidas: ${escalationStats.NOT_UNDERSTOOD}`);
    console.log(`  - 😡 Reclamações de Clientes: ${escalationStats.COMPLAINT}`);
    console.log(`  - ⚙️ Outros Motivos: ${escalationStats.OTHER}`);
    console.log(``);

    console.log(`## 💰 Valor Gerado Estimado (ROI do Produto)`);
    console.log(`- **Tempo de Recepcionista Economizado**: **${hoursSaved.toFixed(1)} horas** (baseado em ${totalMessagesIA} mensagens da IA × 2min)`);
    console.log(`- **Faturamento Estimado Direto**: **R$ ${estimatedRevenue.toFixed(2)}** (Comparecidos + Reservas ativas × R$ 50,00 de ticket médio)`);
    console.log(``);

    if (autonomyPassed && conversionPassed && noShowPassed && npsPassed) {
      console.log(`> 🎉 **CONCLUSÃO:** A barbearia piloto atende a todos os critérios de lançamento comercial! Pronto para expansão em larga escala.`);
    } else {
      console.log(`> ⚠️ **CONCLUSÃO:** Piloto em andamento. Necessário otimizar as métricas de conversão e/ou no-show antes de abrir o go-live geral.`);
    }

  } catch (err: any) {
    console.error('Error executing query:', err.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
