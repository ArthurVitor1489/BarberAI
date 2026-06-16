import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Conversas & Human Handoff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as conversas da barbearia' })
  async list(@Req() req: any) {
    const barbershopId = req['barbershopId'];
    return this.prisma.conversation.findMany({
      where: { barbershopId },
      include: { client: true },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de uma conversa específica' })
  async getOne(@Req() req: any, @Param('id') id: string) {
    const barbershopId = req['barbershopId'];
    const conv = await this.prisma.conversation.findFirst({
      where: { id, barbershopId },
      include: { client: true },
    });
    if (!conv) {
      throw new BadRequestException('Conversa não encontrada nesta barbearia.');
    }
    return conv;
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Obter histórico de mensagens da conversa' })
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

  @Post(':id/messages')
  @ApiOperation({ summary: 'Enviar mensagem para o cliente nesta conversa' })
  async sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body('text') text: string,
  ) {
    const barbershopId = req['barbershopId'];
    const conv = await this.prisma.conversation.findFirst({
      where: { id, barbershopId },
      include: { client: true },
    });
    if (!conv) {
      throw new BadRequestException('Conversa não encontrada nesta barbearia.');
    }
    if (!text || text.trim() === '') {
      throw new BadRequestException('Texto da mensagem não pode ser vazio.');
    }

    const toJid = `${conv.client.phone}@s.whatsapp.net`;
    const message = await this.whatsappService.sendMessage(
      toJid,
      text,
      conv.customerId,
      barbershopId,
      id,
    );

    // Set conversation status
    const newStatus = conv.handoffActive ? 'HUMAN_HANDOFF' : 'OPEN';
    await this.prisma.conversation.update({
      where: { id },
      data: { status: newStatus },
    });

    return message;
  }

  @Patch(':id/handoff')
  @ApiOperation({ summary: 'Ativar ou desativar atendimento humano' })
  async toggleHandoff(
    @Req() req: any,
    @Param('id') id: string,
    @Body('handoffActive') handoffActive: boolean,
  ) {
    const barbershopId = req['barbershopId'];
    const conv = await this.prisma.conversation.findFirst({
      where: { id, barbershopId },
    });
    if (!conv) {
      throw new BadRequestException('Conversa não encontrada nesta barbearia.');
    }

    const newStatus = handoffActive ? 'HUMAN_HANDOFF' : 'OPEN';
    return this.prisma.conversation.update({
      where: { id },
      data: {
        handoffActive,
        status: newStatus,
        assignedToUserId: handoffActive ? req.user?.sub || null : null,
      },
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar status da conversa' })
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const barbershopId = req['barbershopId'];
    const conv = await this.prisma.conversation.findFirst({
      where: { id, barbershopId },
    });
    if (!conv) {
      throw new BadRequestException('Conversa não encontrada nesta barbearia.');
    }

    const allowed = ['OPEN', 'HUMAN_HANDOFF', 'WAITING_CUSTOMER', 'CLOSED'];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Status inválido. Deve ser um de: ${allowed.join(', ')}`);
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { status },
    });
  }

  @Post('test-send')
  @ApiOperation({ summary: 'Enviar mensagem de teste do WhatsApp' })
  async testSend(@Req() req: any, @Body('phone') phone: string) {
    const barbershopId = req['barbershopId'];
    if (!phone) {
      throw new BadRequestException('Número de telefone é obrigatório.');
    }

    // Limpa o número removendo caracteres não numéricos
    const cleanedPhone = phone.replace(/\D/g, '');
    if (!cleanedPhone) {
      throw new BadRequestException('Número de telefone inválido.');
    }

    // 1. Resolve ou cria cliente de teste
    const client = await this.whatsappService.getOrCreateClientByPhone(
      cleanedPhone,
      'Administrador Teste',
      barbershopId,
    );

    // 2. Resolve ou cria conversa
    let conversation = await this.prisma.conversation.findFirst({
      where: { customerId: client.id, barbershopId, status: 'OPEN' },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { customerId: client.id, barbershopId, status: 'OPEN' },
      });
    }

    // 3. Envia mensagem
    const toJid = `${cleanedPhone}@s.whatsapp.net`;
    return this.whatsappService.sendMessage(
      toJid,
      'Olá! Este é um teste do sistema BarberAI. Seu WhatsApp está conectado e o fluxo operacional está ativo! 🚀',
      client.id,
      barbershopId,
      conversation.id,
    );
  }
}
