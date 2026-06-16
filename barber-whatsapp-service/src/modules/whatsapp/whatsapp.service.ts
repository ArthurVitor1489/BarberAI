import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl = this.configService.get<string>('EVOLUTION_API_URL') || '';
    this.apiKey = this.configService.get<string>('EVOLUTION_API_KEY') || '';
  }

  /**
   * Envia uma mensagem via Evolution API para o cliente, vinculando-a ao tenant e à conversa ativa
   */
  async sendMessage(
    toJid: string,
    text: string,
    clientId: string,
    barbershopId: string,
    conversationId?: string,
  ): Promise<any> {
    const phone = toJid.split('@')[0];
    this.logger.log(`Enviando mensagem (Tenant: ${barbershopId}) para ${phone}: "${text.substring(0, 40)}..."`);

    let messageId = `out-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Busca a instância cadastrada para esta barbearia para saber qual nome de instância usar na rota
    const instance = await this.prisma.whatsAppInstance.findFirst({
      where: { barbershopId, status: 'CONNECTED' },
    });

    if (this.apiUrl && this.apiKey && instance) {
      try {
        const response = await axios.post(
          `${this.apiUrl}/message/sendText/${instance.instanceName}`,
          {
            number: phone,
            text: text,
          },
          {
            headers: {
              apikey: this.apiKey,
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.data?.key?.id) {
          messageId = response.data.key.id;
        }
      } catch (error: any) {
        this.logger.error(`Erro ao chamar a Evolution API para a instância ${instance.instanceName}: ${error.message}`);
      }
    } else {
      this.logger.warn(`Evolution API ou instância ativa não configurada para o tenant ${barbershopId}. Mensagem simulada.`);
    }

    // Salva a mensagem enviada associada à barbearia e conversa
    const message = await this.prisma.message.create({
      data: {
        id: messageId,
        text,
        fromMe: true,
        clientId,
        barbershopId,
        conversationId,
      },
    });

    // Atualiza o timestamp da última mensagem na conversa
    if (conversationId) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });
    }

    return message;
  }

  /**
   * Resolve ou cria o cliente com isolamento por barbearia
   */
  async getOrCreateClientByPhone(phone: string, pushName: string, barbershopId: string) {
    let client = await this.prisma.client.findFirst({
      where: { phone, barbershopId },
    });

    if (!client) {
      this.logger.log(`[SaaS Multi-Tenant] Cadastrando cliente: ${pushName} (${phone}) na barbearia ${barbershopId}`);
      client = await this.prisma.client.create({
        data: {
          phone,
          name: pushName || 'Cliente',
          barbershopId,
        },
      });

      // Cria um perfil de CRM vazio para o cliente recém-criado
      await this.prisma.customerProfile.create({
        data: {
          customerId: client.id,
          totalVisits: 0,
          lifetimeValue: 0,
        },
      });
    }

    return client;
  }
}
