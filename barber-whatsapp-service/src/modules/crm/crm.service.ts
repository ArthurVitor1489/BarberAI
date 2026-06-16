import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CRMService {
  private readonly logger = new Logger(CRMService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula e atualiza o CustomerProfile do cliente com base no histórico de agendamentos confirmados
   */
  async updateCustomerProfile(customerId: string, barbershopId: string): Promise<any> {
    this.logger.log(`Recalculando inteligência do cliente para o perfil: ${customerId}`);

    // Busca todos os agendamentos realizados/confirmados do cliente (incluindo o preço do serviço)
    const appointments = await this.prisma.appointment.findMany({
      where: {
        clientId: customerId,
        barbershopId,
        status: 'CONFIRMED',
      },
      include: { service: true },
      orderBy: { dateTime: 'asc' },
    });

    const totalVisits = appointments.length;

    if (totalVisits === 0) {
      // Se não há visitas registradas ainda, cria ou zera o perfil
      return this.prisma.customerProfile.upsert({
        where: { customerId },
        create: {
          customerId,
          totalVisits: 0,
          lifetimeValue: 0,
          averageTicket: 0,
          averageVisitInterval: 0,
        },
        update: {
          totalVisits: 0,
          lifetimeValue: 0,
          averageTicket: 0,
          averageVisitInterval: 0,
          favoriteBarberId: null,
          favoriteServiceId: null,
          lastVisit: null,
        },
      });
    }

    // Calcula LTV (Lifetime Value) e Ticket Médio
    const lifetimeValue = appointments.reduce((sum, appt) => sum + (appt.service?.price || 0), 0);
    const averageTicket = lifetimeValue / totalVisits;

    // Identifica última visita
    const lastVisit = appointments[appointments.length - 1].dateTime;

    // Calcula barbeiro e serviço favorito
    const barberCounts: Record<string, number> = {};
    const serviceCounts: Record<string, number> = {};

    appointments.forEach((appt) => {
      barberCounts[appt.barberId] = (barberCounts[appt.barberId] || 0) + 1;
      serviceCounts[appt.serviceId] = (serviceCounts[appt.serviceId] || 0) + 1;
    });

    let favoriteBarberId: string | null = null;
    let maxBarberVisits = 0;
    for (const barberId in barberCounts) {
      if (barberCounts[barberId] > maxBarberVisits) {
        maxBarberVisits = barberCounts[barberId];
        favoriteBarberId = barberId;
      }
    }

    let favoriteServiceId: string | null = null;
    let maxServiceVisits = 0;
    for (const serviceId in serviceCounts) {
      if (serviceCounts[serviceId] > maxServiceVisits) {
        maxServiceVisits = serviceCounts[serviceId];
        favoriteServiceId = serviceId;
      }
    }

    // Calcula intervalo médio de visitas (em dias)
    let averageVisitInterval = 0;
    if (totalVisits >= 2) {
      let totalIntervalDays = 0;
      for (let i = 1; i < totalVisits; i++) {
        const diffTime = Math.abs(appointments[i].dateTime.getTime() - appointments[i - 1].dateTime.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        totalIntervalDays += diffDays;
      }
      averageVisitInterval = totalIntervalDays / (totalVisits - 1);
    }

    // Atualiza ou insere o perfil analítico no banco
    return this.prisma.customerProfile.upsert({
      where: { customerId },
      create: {
        customerId,
        favoriteBarberId,
        favoriteServiceId,
        lastVisit,
        totalVisits,
        averageVisitInterval,
        averageTicket,
        lifetimeValue,
      },
      update: {
        favoriteBarberId,
        favoriteServiceId,
        lastVisit,
        totalVisits,
        averageVisitInterval,
        averageTicket,
        lifetimeValue,
      },
    });
  }

  /**
   * Retorna se um cliente é classificado como VIP, Recorrente, Inativo, etc.
   */
  async classifyCustomer(customerId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { customerId },
    });

    if (!profile) return { isVIP: false, isInactive: false, isRecurrent: false };

    const isVIP = profile.totalVisits > 10 || profile.lifetimeValue > 1000;
    const isRecurrent = profile.totalVisits >= 3;

    let isInactive = false;
    if (profile.lastVisit && profile.averageVisitInterval > 0) {
      const daysSinceLastVisit = Math.floor(
        Math.abs(Date.now() - new Date(profile.lastVisit).getTime()) / (1000 * 60 * 60 * 24),
      );
      isInactive = daysSinceLastVisit > profile.averageVisitInterval;
    }

    return {
      isVIP,
      isRecurrent,
      isInactive,
    };
  }

  /**
   * Busca todos os clientes inativos de uma barbearia
   */
  async getInactiveCustomers(barbershopId: string) {
    const profiles = await this.prisma.customerProfile.findMany({
      where: {
        client: { barbershopId },
        lastVisit: { lte: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }, // Pelo menos 15 dias atrás
      },
      include: { client: true },
    });

    return profiles.filter((profile) => {
      if (!profile.lastVisit) return false;
      const daysSinceLast = Math.floor(
        Math.abs(Date.now() - new Date(profile.lastVisit).getTime()) / (1000 * 60 * 60 * 24),
      );
      // Intervalo de visita padrão de 30 dias se o histórico for curto
      const threshold = profile.averageVisitInterval > 0 ? profile.averageVisitInterval : 30;
      return daysSinceLast > threshold;
    });
  }
}
