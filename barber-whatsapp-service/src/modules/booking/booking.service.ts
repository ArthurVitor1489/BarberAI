import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../database/audit.service';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
  ) {}

  // Gera os horários de expediente padrão (09:00 às 18:00, em horas cheias)
  private getOperationalSlots(dateStr: string): Date[] {
    const slots: Date[] = [];
    const date = new Date(dateStr);
    
    // Cria horários de 09:00 até 18:00 (inclusive)
    for (let hour = 9; hour <= 18; hour++) {
      const slotDate = new Date(date);
      slotDate.setUTCHours(hour, 0, 0, 0);
      slots.push(slotDate);
    }
    return slots;
  }

  /**
   * Busca os horários disponíveis em uma data específica filtrando por barbearia
   */
  async buscarHorariosDisponiveis(clientId: string, barbershopId: string, dateStr?: string): Promise<string[]> {
    const targetDateStr = dateStr || new Date().toISOString().split('T')[0];
    
    const startOfDay = new Date(targetDateStr);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDateStr);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Busca agendamentos ativos na barbearia para o dia
    const booked = await this.prisma.appointment.findMany({
      where: {
        barbershopId,
        dateTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: 'CANCELLED',
        },
      },
      select: {
        dateTime: true,
      },
    });

    const bookedHours = booked.map(b => b.dateTime.toISOString());
    const allSlots = this.getOperationalSlots(targetDateStr);

    const availableSlots = allSlots
      .filter(slot => !bookedHours.includes(slot.toISOString()))
      .map(slot => {
        const hours = String(slot.getUTCHours()).padStart(2, '0');
        const minutes = String(slot.getUTCMinutes()).padStart(2, '0');
        return `${targetDateStr} ${hours}:${minutes}`;
      });

    return availableSlots;
  }

  /**
   * Cria um novo agendamento na barbearia e vincula o barbeiro e serviço
   */
  async criarAgendamento(
    clientId: string,
    barbershopId: string,
    dateTimeStr: string,
    serviceId: string,
    barberId: string,
    notes?: string,
  ) {
    const formattedStr = dateTimeStr.replace(' ', 'T') + (dateTimeStr.includes('T') ? '' : ':00Z');
    const date = new Date(formattedStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Formato de data/hora inválido. Use AAAA-MM-DD HH:MM');
    }

    const hour = date.getUTCHours();
    if (hour < 9 || hour > 18 || date.getUTCMinutes() !== 0) {
      throw new BadRequestException('O expediente é das 09:00 às 18:00 (apenas horas cheias).');
    }

    if (date.getTime() < Date.now()) {
      throw new BadRequestException('Não é possível criar agendamento no passado.');
    }

    const lockKey = `lock:appointment:${barberId}:${date.toISOString()}`;
    const acquired = await this.redisService.acquireLock(lockKey, 10);
    if (!acquired) {
      throw new BadRequestException('Este horário já está sendo agendado. Por favor, tente novamente.');
    }

    try {
      const resultAppt = await this.prisma.$transaction(async (tx) => {
        // Verifica se o barbeiro existe e pertence à barbearia
        const barber = await tx.barber.findFirst({
          where: { id: barberId, barbershopId, active: true },
        });
        if (!barber) {
          throw new BadRequestException('Barbeiro inválido ou não disponível nesta barbearia.');
        }

        // Verifica se o serviço existe e pertence à barbearia
        const service = await tx.service.findFirst({
          where: { id: serviceId, barbershopId, active: true },
        });
        if (!service) {
          throw new BadRequestException('Serviço inválido ou inativo nesta barbearia.');
        }

        // Verifica conflito de horário para este barbeiro específico
        const existingBarberBooking = await tx.appointment.findFirst({
          where: {
            barberId,
            barbershopId,
            dateTime: date,
            status: { not: 'CANCELLED' },
          },
        });
        if (existingBarberBooking) {
          throw new BadRequestException('Este barbeiro já tem um agendamento neste horário.');
        }

        // Verifica conflito de horário para este mesmo cliente na barbearia
        const userExisting = await tx.appointment.findFirst({
          where: {
            clientId,
            barbershopId,
            dateTime: date,
            status: { not: 'CANCELLED' },
          },
        });
        if (userExisting) {
          throw new BadRequestException('Você já possui um agendamento neste mesmo horário.');
        }

        const appt = await tx.appointment.create({
          data: {
            dateTime: date,
            clientId,
            serviceId,
            barberId,
            barbershopId,
            notes,
            status: 'CONFIRMED',
          },
          include: {
            service: true,
            barber: true,
            client: true,
          },
        });

        // Registra auditoria
        await this.auditService.log('CREATE', 'Appointment', appt.id, null, barbershopId, tx);

        // Registra evento no outbox
        await tx.eventOutbox.create({
          data: {
            eventType: 'appointment.created.v1',
            payload: JSON.stringify({
              appointmentId: appt.id,
              clientId,
              barberId,
              serviceId,
              barbershopId,
              dateTime: date.toISOString(),
            }),
          },
        });

        // Registra métrica diária
        try {
          const today = new Date();
          await tx.dailyMetrics.upsert({
            where: {
              date_barbershopId: {
                date: new Date(today.setUTCHours(0,0,0,0)),
                barbershopId,
              },
            },
            create: {
              date: new Date(today.setUTCHours(0,0,0,0)),
              barbershopId,
              appointments: 1,
              revenue: service.price,
            },
            update: {
              appointments: { increment: 1 },
              revenue: { increment: service.price },
            },
          });
        } catch (metricErr) {
          // Ignora erro nas métricas para não quebrar a transação principal
        }

        return appt;
      });

      this.metricsService.incrementAppointmentsCreated();
      return resultAppt;
    } finally {
      await this.redisService.releaseLock(lockKey);
    }
  }

  /**
   * Cancela um agendamento na barbearia
   */
  async cancelarAgendamento(clientId: string, barbershopId: string, appointmentId?: string) {
    return this.prisma.$transaction(async (tx) => {
      let appointment;

      if (appointmentId && appointmentId !== 'upcoming' && appointmentId.trim() !== '') {
        appointment = await tx.appointment.findFirst({
          where: {
            id: appointmentId,
            clientId,
            barbershopId,
          },
          include: { service: true },
        });
      } else {
        appointment = await tx.appointment.findFirst({
          where: {
            clientId,
            barbershopId,
            status: { not: 'CANCELLED' },
            dateTime: { gte: new Date() },
          },
          orderBy: { dateTime: 'asc' },
          include: { service: true },
        });
      }

      if (!appointment) {
        throw new NotFoundException('Nenhum agendamento ativo encontrado para cancelamento.');
      }

      const updatedAppt = await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CANCELLED' },
      });

      // Registra auditoria
      await this.auditService.log('CANCEL', 'Appointment', updatedAppt.id, null, barbershopId, tx);

      // Registra evento no outbox
      await tx.eventOutbox.create({
        data: {
          eventType: 'appointment.cancelled.v1',
          payload: JSON.stringify({
            appointmentId: appointment.id,
            clientId,
            barberId: appointment.barberId,
            serviceId: appointment.serviceId,
            barbershopId,
            dateTime: appointment.dateTime.toISOString(),
          }),
        },
      });

      // Atualiza métrica diária de cancelamento
      try {
        const today = new Date();
        await tx.dailyMetrics.upsert({
          where: {
            date_barbershopId: {
              date: new Date(today.setUTCHours(0,0,0,0)),
              barbershopId,
            },
          },
          create: {
            date: new Date(today.setUTCHours(0,0,0,0)),
            barbershopId,
            cancellations: 1,
            revenue: -appointment.service.price,
          },
          update: {
            cancellations: { increment: 1 },
            revenue: { decrement: appointment.service.price },
          },
        });
      } catch (metricErr) {
        // Silencia
      }

      return updatedAppt;
    });
  }

  /**
   * Remarca um agendamento existente para uma nova data/hora
   */
  async remarcarAgendamento(clientId: string, barbershopId: string, appointmentId: string, newDateTimeStr: string) {
    let appointment;

    if (appointmentId && appointmentId !== 'upcoming' && appointmentId.trim() !== '') {
      appointment = await this.prisma.appointment.findFirst({
        where: { id: appointmentId, clientId, barbershopId },
      });
    } else {
      appointment = await this.prisma.appointment.findFirst({
        where: {
          clientId,
          barbershopId,
          status: { not: 'CANCELLED' },
          dateTime: { gte: new Date() },
        },
        orderBy: { dateTime: 'asc' },
      });
    }

    if (!appointment) {
      throw new NotFoundException('Nenhum agendamento ativo encontrado para remarcação.');
    }

    const formattedStr = newDateTimeStr.replace(' ', 'T') + (newDateTimeStr.includes('T') ? '' : ':00Z');
    const newDate = new Date(formattedStr);
    if (isNaN(newDate.getTime())) {
      throw new BadRequestException('Formato de nova data/hora inválido. Use AAAA-MM-DD HH:MM');
    }

    const hour = newDate.getUTCHours();
    if (hour < 9 || hour > 18 || newDate.getUTCMinutes() !== 0) {
      throw new BadRequestException('O expediente é das 09:00 às 18:00 (apenas horas cheias).');
    }

    if (newDate.getTime() < Date.now()) {
      throw new BadRequestException('Não é possível remarcar para um horário passado.');
    }

    // Verifica se o barbeiro está livre no novo horário
    const barberConflict = await this.prisma.appointment.findFirst({
      where: {
        barberId: appointment.barberId,
        barbershopId,
        dateTime: newDate,
        status: { not: 'CANCELLED' },
        id: { not: appointment.id },
      },
    });

    if (barberConflict) {
      throw new BadRequestException('O barbeiro já tem agendamento neste novo horário.');
    }

    const updatedAppt = await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        dateTime: newDate,
        status: 'CONFIRMED',
      },
    });

    // Registra auditoria
    await this.auditService.log('RESCHEDULE', 'Appointment', updatedAppt.id, null, barbershopId);

    return updatedAppt;
  }
}
