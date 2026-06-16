import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { CRMService } from './crm.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CampaignScheduler {
  private readonly logger = new Logger(CampaignScheduler.name);
  private openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly crmService: CRMService,
    private readonly whatsappService: WhatsappService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') || 'mock-key';
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Executa diariamente às 09:00 para reengajar clientes inativos
   * CronExpression.EVERY_DAY_AT_9AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runDailyCampaigns() {
    this.logger.log('Iniciando rotina diária de campanhas de reengajamento automatizadas...');

    // 1. Busca todas as barbearias com assinatura ativa que suporta IA (PREMIUM_AI)
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        plan: 'PREMIUM_AI',
        status: 'ACTIVE',
        expiresAt: { gte: new Date() },
      },
      select: { barbershopId: true },
    });

    this.logger.log(`Encontradas ${activeSubscriptions.length} barbearias elegíveis para campanhas IA.`);

    for (const sub of activeSubscriptions) {
      const barbershopId = sub.barbershopId;
      
      try {
        // 2. Busca os clientes inativos da barbearia
        const inactiveProfiles = await this.crmService.getInactiveCustomers(barbershopId);
        this.logger.log(`Barbearia ${barbershopId}: Encontrados ${inactiveProfiles.length} clientes inativos.`);

        for (const profile of inactiveProfiles) {
          const client = profile.client;
          if (!client.aiEnabled) continue;

          // Calcula dias desde a última visita
          let daysSinceLast = 30;
          if (profile.lastVisit) {
            const diffTime = Math.abs(Date.now() - new Date(profile.lastVisit).getTime());
            daysSinceLast = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          }

          // 3. Gera mensagem personalizada de reengajamento via OpenAI
          this.logger.log(`Gerando campanha personalizada para ${client.name} (${client.phone})`);
          
          let messageContent = `Olá ${client.name}! Faz um tempinho desde sua última visita. Temos horários disponíveis esta semana. Deseja agendar?`;

          if (this.configService.get<string>('OPENAI_API_KEY') && this.configService.get<string>('OPENAI_API_KEY') !== 'sua_chave_api_openai_aqui') {
            try {
              const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: 'Você é a recepcionista virtual de uma barbearia. Escreva uma mensagem de reengajamento personalizada para o WhatsApp, chamando o cliente pelo nome. Seja simpática, use emojis com moderação, e convide-o de maneira sutil a agendar um horário. O tom deve ser natural e humanizado (nunca fale que é um robô/IA). Escreva no máximo 2 frases.',
                  },
                  {
                    role: 'user',
                    content: `Gere a mensagem de reengajamento para o cliente: ${client.name}. Última visita dele foi há ${daysSinceLast} dias.`,
                  },
                ],
              });
              if (completion.choices[0]?.message?.content) {
                messageContent = completion.choices[0].message.content;
              }
            } catch (openAiErr: any) {
              this.logger.error(`Falha ao gerar texto na OpenAI para campanha: ${openAiErr.message}`);
            }
          }

          // 4. Dispara a mensagem via WhatsApp
          const remoteJid = `${client.phone}@s.whatsapp.net`;
          await this.whatsappService.sendMessage(remoteJid, messageContent, client.id, barbershopId);

          this.logger.log(`Campanha disparada para ${client.name} via WhatsApp.`);
        }
      } catch (shopErr: any) {
        this.logger.error(`Erro ao processar campanhas para a barbearia ${barbershopId}: ${shopErr.stack}`);
      }
    }

    this.logger.log('Rotina diária de campanhas finalizada.');
  }
}
