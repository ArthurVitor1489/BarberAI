import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna um resumo financeiro e contadores rápidos da barbearia (excluindo soft deleted)
   */
  async getDashboardSummary(barbershopId: string) {
    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setUTCHours(0, 0, 0, 0);

    const endOfToday = new Date(today);
    endOfToday.setUTCHours(23, 59, 59, 999);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Agendamentos ativos de hoje (não excluídos e não cancelados)
    const appointmentsToday = await this.prisma.appointment.count({
      where: {
        barbershopId,
        dateTime: {
          gte: startOfToday,
          lte: endOfToday,
        },
        status: {
          not: 'CANCELLED',
        },
        deletedAt: null,
      },
    });

    // Total de clientes cadastrados (não excluídos)
    const customers = await this.prisma.client.count({
      where: { barbershopId, deletedAt: null },
    });

    // Total de barbeiros ativos (não excluídos)
    const barbers = await this.prisma.barber.count({
      where: { barbershopId, active: true, deletedAt: null },
    });

    // Total de serviços ativos (não excluídos)
    const services = await this.prisma.service.count({
      where: { barbershopId, active: true, deletedAt: null },
    });

    // Faturamento do mês (soma dos valores dos serviços agendados e confirmados no mês)
    const appointmentsThisMonth = await this.prisma.appointment.findMany({
      where: {
        barbershopId,
        dateTime: {
          gte: startOfMonth,
        },
        status: {
          not: 'CANCELLED',
        },
        deletedAt: null,
      },
      select: {
        service: {
          select: {
            price: true,
          },
        },
      },
    });

    const revenueMonth = appointmentsThisMonth.reduce(
      (sum, appt) => sum + (appt.service?.price || 0),
      0,
    );

    return {
      appointmentsToday,
      customers,
      barbers,
      services,
      revenueMonth,
    };
  }

  /**
   * Listagem de agendamentos com paginação e filtros (ignora soft-deleted)
   */
  async getAppointments(
    barbershopId: string,
    filters: { date?: string; barberId?: string; status?: string; page?: number; limit?: number },
  ) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = { barbershopId, deletedAt: null };

    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      whereClause.dateTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (filters.barberId) {
      whereClause.barberId = filters.barberId;
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where: whereClause,
        include: {
          client: true,
          service: true,
          barber: true,
        },
        orderBy: { dateTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where: whereClause }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Listagem de clientes com paginação e filtros (ignora soft-deleted)
   */
  async getCustomers(
    barbershopId: string,
    filters: { name?: string; phone?: string; frequency?: string; page?: number; limit?: number },
  ) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = { barbershopId, deletedAt: null };

    if (filters.name) {
      whereClause.name = { contains: filters.name, mode: 'insensitive' };
    }

    if (filters.phone) {
      whereClause.phone = { contains: filters.phone };
    }

    if (filters.frequency) {
      if (filters.frequency === 'VIP') {
        whereClause.customerProfile = { totalVisits: { gt: 10 } };
      } else if (filters.frequency === 'RECURRENT') {
        whereClause.customerProfile = { totalVisits: { gte: 3, lte: 10 } };
      } else if (filters.frequency === 'LOW') {
        whereClause.customerProfile = { totalVisits: { lt: 3 } };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where: whereClause,
        include: {
          customerProfile: {
            include: {
              favoriteBarber: true,
              favoriteService: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.client.count({ where: whereClause }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}
