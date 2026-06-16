import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Telemetria do Piloto')
@ApiBearerAuth()
@Controller()
export class PilotController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('feedback')
  @ApiOperation({ summary: 'Enviar feedback estruturado com avaliações e NPS' })
  async submitFeedback(@Req() req: any, @Body() body: any) {
    const userId = req.user?.sub;
    const barbershopId = req['barbershopId'];

    if (
      body.ratingAgenda === undefined ||
      body.ratingWhatsapp === undefined ||
      body.ratingIA === undefined ||
      body.ratingDashboard === undefined ||
      body.ratingSupport === undefined ||
      body.nps === undefined
    ) {
      throw new BadRequestException('Todas as notas de satisfação e o NPS são obrigatórios.');
    }

    return this.prisma.feedback.create({
      data: {
        comment: body.comment || '',
        ratingAgenda: Number(body.ratingAgenda),
        ratingWhatsapp: Number(body.ratingWhatsapp),
        ratingIA: Number(body.ratingIA),
        ratingDashboard: Number(body.ratingDashboard),
        ratingSupport: Number(body.ratingSupport),
        nps: Number(body.nps),
        userId,
        barbershopId,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('usage/log')
  @ApiOperation({ summary: 'Registrar log de utilização de uma funcionalidade' })
  async logUsage(@Req() req: any, @Body('action') action: string) {
    const userId = req.user?.sub;
    const barbershopId = req['barbershopId'];

    if (!action) {
      throw new BadRequestException('A ação a ser registrada é obrigatória.');
    }

    return this.prisma.usageLog.create({
      data: {
        action,
        userId,
        barbershopId,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/escalate')
  @ApiOperation({ summary: 'Acionar atendimento humano informando o motivo do escalonamento' })
  async escalateConversation(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    const barbershopId = req['barbershopId'];

    const conv = await this.prisma.conversation.findFirst({
      where: { id, barbershopId },
    });

    if (!conv) {
      throw new BadRequestException('Conversa não encontrada nesta barbearia.');
    }

    const allowed = ['HUMAN_REQUEST', 'COMPLEX_REQUEST', 'NOT_UNDERSTOOD', 'COMPLAINT', 'OTHER'];
    if (!allowed.includes(reason)) {
      throw new BadRequestException(`Motivo inválido. Escolha um entre: ${allowed.join(', ')}`);
    }

    // 1. Registra o motivo do Handoff
    await this.prisma.aIEscalationReason.create({
      data: {
        conversationId: id,
        reason,
      },
    });

    // 2. Registra no UsageLog
    await this.prisma.usageLog.create({
      data: {
        action: `HANDOFF_ON_${reason}`,
        userId: req.user?.sub,
        barbershopId,
      },
    });

    // 3. Atualiza status da conversa
    return this.prisma.conversation.update({
      where: { id },
      data: {
        handoffActive: true,
        status: 'HUMAN_HANDOFF',
        assignedToUserId: req.user?.sub || null,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/pilot-metrics')
  @ApiOperation({ summary: 'Obter painel completo de Product Analytics para o Piloto 01' })
  async getPilotMetrics(@Req() req: any) {
    const barbershopId = req['barbershopId'];

    // 1. Total de conversas
    const conversations = await this.prisma.conversation.findMany({
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

    // 4. Funil de Vendas: Iniciadas -> Qualificadas -> Convertidas -> Comparecidas
    const started = totalConversations;

    // Qualificada = Contém palavras-chave de intenção de agendamento nas mensagens
    const qualified = conversations.filter((c) =>
      c.messages.some((m) =>
        /agendar|corte|barba|preço|vaga|horário|marcar|valor/i.test(m.text),
      ),
    ).length;

    // Convertidas = Agendamentos ativos/finalizados criados via IA
    const converted = await this.prisma.appointment.count({
      where: {
        barbershopId,
        notes: { contains: '[IA]' },
        deletedAt: null,
      },
    });

    // Comparecidas = Agendamentos finalizados com status COMPLETED
    const attended = await this.prisma.appointment.count({
      where: {
        barbershopId,
        status: 'COMPLETED',
        deletedAt: null,
      },
    });

    const bookingConversionRate = started > 0 ? (converted / started) * 100 : 0;

    // 5. No Show Rate
    const missedCount = await this.prisma.appointment.count({
      where: {
        barbershopId,
        status: 'NOSHOW',
        deletedAt: null,
      },
    });
    const completedCount = attended;
    const totalConcluded = missedCount + completedCount;
    const noShowRate = totalConcluded > 0 ? (missedCount / totalConcluded) * 100 : 0;

    // 6. Horas Economizadas (Mensagens IA * 2 minutos)
    const totalMessagesIA = await this.prisma.message.count({
      where: {
        barbershopId,
        fromMe: true,
        // Mensagens que não foram em contexto de handoff
        conversation: {
          handoffActive: false,
        },
      },
    });
    const hoursSaved = (totalMessagesIA * 2) / 60;

    // 7. Handoff Analytics (Motivos)
    const escalations = await this.prisma.aIEscalationReason.findMany({
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

    // 8. CRM: Clientes Recuperados
    // Cliente inativo = sem agendamentos por >30 dias, mas que realizou um agendamento novo recentemente
    // Vamos calcular via appointments agrupando por cliente
    const clients = await this.prisma.client.findMany({
      where: { barbershopId, deletedAt: null },
      include: {
        appointments: {
          where: { deletedAt: null, status: 'COMPLETED' },
          orderBy: { dateTime: 'asc' },
        },
      },
    });

    let recoveredClientsCount = 0;
    let recoveredRevenue = 0;

    clients.forEach((c) => {
      if (c.appointments.length >= 2) {
        for (let i = 1; i < c.appointments.length; i++) {
          const prevDate = new Date(c.appointments[i - 1].dateTime).getTime();
          const currDate = new Date(c.appointments[i].dateTime).getTime();
          const gapDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
          if (gapDays > 30) {
            recoveredClientsCount++;
            // Soma o preço do serviço desse agendamento recuperado
            recoveredRevenue += 50; // valor médio fixo estimativo ou podemos somar se tivéssemos o valor total
            break;
          }
        }
      }
    });

    // 9. NPS e Satisfação Média
    const feedbacks = await this.prisma.feedback.findMany({
      where: { barbershopId },
    });
    const totalFeedbacks = feedbacks.length;
    const avgNps = totalFeedbacks > 0 ? feedbacks.reduce((sum, f) => sum + f.nps, 0) / totalFeedbacks : 0;
    
    const avgRatings = {
      agenda: totalFeedbacks > 0 ? feedbacks.reduce((sum, f) => sum + f.ratingAgenda, 0) / totalFeedbacks : 0,
      whatsapp: totalFeedbacks > 0 ? feedbacks.reduce((sum, f) => sum + f.ratingWhatsapp, 0) / totalFeedbacks : 0,
      ia: totalFeedbacks > 0 ? feedbacks.reduce((sum, f) => sum + f.ratingIA, 0) / totalFeedbacks : 0,
      dashboard: totalFeedbacks > 0 ? feedbacks.reduce((sum, f) => sum + f.ratingDashboard, 0) / totalFeedbacks : 0,
      support: totalFeedbacks > 0 ? feedbacks.reduce((sum, f) => sum + f.ratingSupport, 0) / totalFeedbacks : 0,
    };

    // 10. Receita Estimativa Geral (Total de Comparecidos + Convertidos × R$ 50 média)
    const estimatedRevenue = (completedCount * 50) + (converted * 50);

    return {
      conversations: {
        total: totalConversations,
        resolvedByAI: resolvedConversations,
        handoffCount: handoffConversations,
      },
      rates: {
        iaResolutionRate,
        humanHandoffRate,
        bookingConversionRate,
        noShowRate,
      },
      funnel: {
        started,
        qualified,
        converted,
        attended,
      },
      escalationStats,
      crm: {
        recoveredClients: recoveredClientsCount,
        recoveredRevenue,
      },
      feedback: {
        total: totalFeedbacks,
        nps: avgNps,
        ratings: avgRatings,
      },
      hoursSaved,
      estimatedRevenue,
    };
  }
}
