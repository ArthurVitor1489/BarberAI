import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AIContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Constrói o contexto dinâmico completo de uma barbearia e de um cliente para alimentar o prompt do OpenAI
   */
  async buildContext(barbershopId: string, clientId: string) {
    // 1. Busca dados cadastrais da barbearia
    const barbershop = await this.prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        name: true,
        address: true,
        phone: true,
        workingHours: true,
        timezone: true,
      },
    });

    // 2. Busca lista de profissionais ativos
    const barbers = await this.prisma.barber.findMany({
      where: { barbershopId, active: true },
      select: {
        id: true,
        name: true,
        specialty: true,
      },
    });

    // 3. Busca lista de serviços e preços ativos
    const services = await this.prisma.service.findMany({
      where: { barbershopId, active: true },
      select: {
        id: true,
        name: true,
        price: true,
        durationMinutes: true,
      },
    });

    // 4. Busca dados do cliente e histórico de preferências
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        customerProfile: {
          include: {
            favoriteBarber: { select: { name: true } },
            favoriteService: { select: { name: true } },
          },
        },
      },
    });

    // 5. Busca os últimos agendamentos do cliente
    const recentAppointments = await this.prisma.appointment.findMany({
      where: { clientId, barbershopId },
      orderBy: { dateTime: 'desc' },
      take: 3,
      select: {
        dateTime: true,
        status: true,
        service: { select: { name: true } },
        barber: { select: { name: true } },
      },
    });

    // Calcula a quantidade de dias desde o último atendimento concluído/confirmado
    let daysSinceLastVisit: number | null = null;
    if (client?.customerProfile?.lastVisit) {
      const diffTime = Math.abs(Date.now() - new Date(client.customerProfile.lastVisit).getTime());
      daysSinceLastVisit = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      barbershop: barbershop || { name: 'Barbearia Premium', address: 'Endereço Indefinido', workingHours: '09:00-18:00', timezone: 'America/Sao_Paulo' },
      barbers: barbers || [],
      services: services || [],
      customer: {
        name: client?.name || 'Cliente',
        phone: client?.phone || '',
        favoriteBarber: client?.customerProfile?.favoriteBarber?.name || 'Não possui',
        favoriteService: client?.customerProfile?.favoriteService?.name || 'Não possui',
        totalVisits: client?.customerProfile?.totalVisits || 0,
        averageVisitInterval: client?.customerProfile?.averageVisitInterval || 0,
        averageTicket: client?.customerProfile?.averageTicket || 0,
        lifetimeValue: client?.customerProfile?.lifetimeValue || 0,
        daysSinceLastVisit,
      },
      recentAppointments: recentAppointments.map((appt) => ({
        dateTime: appt.dateTime.toISOString(),
        status: appt.status,
        service: appt.service?.name || 'Serviço',
        barber: appt.barber?.name || 'Barbeiro',
      })),
    };
  }
}
