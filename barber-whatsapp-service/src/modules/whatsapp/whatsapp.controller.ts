import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Patch, Param, Req, BadRequestException, Get, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { AIService } from '../ai/ai.service';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Atendimento WhatsApp')
@ApiBearerAuth()
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly aiService: AIService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    if (!payload || !payload.event) {
      return { status: 'invalid_payload' };
    }

    if (payload.event !== 'messages.upsert') {
      return { status: 'ignored_event', event: payload.event };
    }

    const data = payload.data;
    if (!data || !data.key) {
      return { status: 'invalid_data' };
    }

    const key = data.key;
    const fromMe = key.fromMe;

    if (fromMe) {
      return { status: 'ignored_from_me' };
    }

    const remoteJid = key.remoteJid;
    if (remoteJid && remoteJid.endsWith('@g.us')) {
      return { status: 'ignored_group' };
    }

    const instanceName = payload.instance;
    // 1. Resolve o tenant (Barbershop) a partir da instância cadastrada
    const dbInstance = await this.prisma.whatsAppInstance.findUnique({
      where: { instanceName },
    });

    if (!dbInstance) {
      this.logger.warn(`Webhook recebido para instância não registrada no SaaS: ${instanceName}`);
      return { status: 'unregistered_instance', instanceName };
    }

    const barbershopId = dbInstance.barbershopId;
    const phone = remoteJid.split('@')[0];
    const pushName = data.pushName || 'Cliente';
    const messageId = key.id;

    if (!messageId) {
      return { status: 'invalid_message_id' };
    }

    // Webhook Idempotency Check
    try {
      await this.prisma.webhookEvent.create({
        data: {
          eventId: messageId,
          provider: 'EVOLUTION_API',
        },
      });
    } catch (dbError: any) {
      if (dbError.code === 'P2002') {
        this.logger.log(`[Idempotency] Webhook event ${messageId} already processed. Ignoring.`);
        return { status: 'already_processed', messageId };
      }
      this.logger.error(`Error saving WebhookEvent for idempotency: ${dbError.message}`);
    }

    const text = data.message?.conversation || data.message?.extendedTextMessage?.text || '';

    if (!text || text.trim() === '') {
      return { status: 'empty_text' };
    }

    this.logger.log(`[Multi-Tenant Webhook] Barbearia: ${barbershopId} - Msg de ${pushName} (${phone}): "${text}"`);

    // 2. Obtém ou cria o cliente isolado por barbearia
    const client = await this.whatsappService.getOrCreateClientByPhone(phone, pushName, barbershopId);

    // 3. Resolve ou cria a conversa ativa
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        customerId: client.id,
        barbershopId,
        status: 'OPEN',
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          customerId: client.id,
          barbershopId,
          status: 'OPEN',
        },
      });
    }

    // 4. Salva a mensagem recebida no histórico
    try {
      await this.prisma.message.create({
        data: {
          id: messageId,
          text,
          fromMe: false,
          clientId: client.id,
          barbershopId,
          conversationId: conversation.id,
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });
    } catch (dbError: any) {
      if (dbError.code === 'P2002') {
        return { status: 'already_processed', messageId };
      }
      this.logger.error(`Erro ao salvar mensagem recebida: ${dbError.message}`);
    }

    // 5. HUMAN HANDOFF: Se a conversa foi assumida por um humano, a IA silencia
    if (conversation.handoffActive) {
      this.logger.log(`[Handoff Ativo] Conversa de ${phone} está sob controle humano. IA silenciada.`);
      return { status: 'handoff_active_silenced', conversationId: conversation.id };
    }

    // 6. CLIENT LEVEL SILENCE: Se a IA foi desligada pelo barbeiro para este cliente
    if (!client.aiEnabled) {
      this.logger.log(`[IA Desabilitada] Recepção IA inativa para o cliente ${phone}.`);
      return { status: 'ai_disabled_silenced', clientId: client.id };
    }

    // 7. Processa a resposta utilizando a IA com contexto dinâmico da barbearia
    const aiResponse = await this.aiService.processChat(barbershopId, client.id, client.name, text);

    // 8. Envia a resposta gerada de volta
    await this.whatsappService.sendMessage(remoteJid, aiResponse, client.id, barbershopId, conversation.id);

    return { status: 'processed', messageId };
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  @ApiOperation({ summary: 'Listar conversas de WhatsApp ativas da barbearia' })
  async getConversations(@Req() req: any) {
    const barbershopId = req['barbershopId'];
    return this.prisma.conversation.findMany({
      where: { barbershopId },
      include: { client: true },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversation/:id/messages')
  @ApiOperation({ summary: 'Listar histórico de mensagens de uma conversa específica' })
  async getMessages(@Req() req: any, @Param('id') id: string) {
    const barbershopId = req['barbershopId'];
    const conv = await this.prisma.conversation.findFirst({
      where: { id, barbershopId },
    });
    if (!conv) {
      throw new BadRequestException('Conversa não encontrada nesta barbearia.');
    }
    return this.prisma.message.findMany({
      where: { conversationId: id, barbershopId },
      orderBy: { timestamp: 'asc' },
    });
  }

  /**
   * Endpoint para ativar/desativar o Human Handoff (Fase 14)
   * PATCH /whatsapp/conversation/:id/handoff
   */
  @UseGuards(JwtAuthGuard)
  @Patch('conversation/:id/handoff')
  async toggleHandoff(
    @Param('id') id: string,
    @Body('handoffActive') handoffActive: boolean,
    @Body('assignedToUserId') assignedToUserId?: string,
    @Req() req?: any,
  ) {
    const barbershopId = req ? req['barbershopId'] : undefined;

    // Se houver barbershopId na requisição, garante que pertence a ela (Middleware de segurança)
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, ...(barbershopId ? { barbershopId } : {}) },
    });

    if (!conversation) {
      throw new BadRequestException('Conversa não encontrada ou não pertence a esta barbearia.');
    }

    return this.prisma.conversation.update({
      where: { id },
      data: {
        handoffActive,
        assignedToUserId: handoffActive ? assignedToUserId || null : null,
      },
    });
  }

  /**
   * Endpoint para ativar/desativar a IA por cliente (Fase 1)
   * PATCH /whatsapp/client/:phone/toggle-ai
   */
  @UseGuards(JwtAuthGuard)
  @Patch('client/:phone/toggle-ai')
  async toggleClientAI(
    @Param('phone') phone: string,
    @Body('aiEnabled') aiEnabled: boolean,
    @Req() req: any,
  ) {
    const barbershopId = req['barbershopId'];

    const client = await this.prisma.client.findFirst({
      where: { phone, barbershopId },
    });

    if (!client) {
      throw new BadRequestException('Cliente não encontrado nesta barbearia.');
    }

    return this.prisma.client.update({
      where: { id: client.id },
      data: { aiEnabled },
    });
  }
}
