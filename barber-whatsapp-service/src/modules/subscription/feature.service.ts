import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FeatureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna o plano ativo atual da barbearia
   */
  private async getPlan(barbershopId: string): Promise<string> {
    const sub = await this.prisma.subscription.findUnique({
      where: { barbershopId },
    });

    if (!sub || sub.status !== 'ACTIVE' || new Date(sub.expiresAt) < new Date()) {
      return 'STARTER';
    }

    return sub.plan;
  }

  /**
   * Habilita recepcionista virtual com Inteligência Artificial
   */
  async canUseAI(barbershopId: string): Promise<boolean> {
    const plan = await this.getPlan(barbershopId);
    return plan === 'PREMIUM_AI';
  }

  /**
   * Habilita CRM, histórico inteligente e métricas de LTV/Ticket Médio
   */
  async canUseCRM(barbershopId: string): Promise<boolean> {
    const plan = await this.getPlan(barbershopId);
    return plan === 'PRO' || plan === 'PREMIUM_AI';
  }

  /**
   * Habilita disparos automáticos diários de campanhas para reengajamento de clientes
   */
  async canUseCampaigns(barbershopId: string): Promise<boolean> {
    const plan = await this.getPlan(barbershopId);
    return plan === 'PREMIUM_AI';
  }
}
