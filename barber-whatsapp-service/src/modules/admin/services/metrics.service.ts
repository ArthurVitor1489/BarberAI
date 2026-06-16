import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Incrementa ou decrementa métricas diárias de forma atômica
   */
  async recordMetric(
    barbershopId: string,
    date: Date,
    field: 'appointments' | 'revenue' | 'newCustomers' | 'cancellations',
    value: number = 1,
  ) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    return this.prisma.dailyMetrics.upsert({
      where: {
        date_barbershopId: {
          date: startOfDay,
          barbershopId,
        },
      },
      create: {
        date: startOfDay,
        barbershopId,
        appointments: field === 'appointments' ? value : 0,
        revenue: field === 'revenue' ? value : 0,
        newCustomers: field === 'newCustomers' ? value : 0,
        cancellations: field === 'cancellations' ? value : 0,
      },
      update: {
        [field]: {
          increment: value,
        },
      },
    });
  }
}
