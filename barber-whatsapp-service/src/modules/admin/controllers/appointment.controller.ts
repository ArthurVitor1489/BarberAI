import { Controller, Post, Patch, Delete, Body, Param, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { BookingService } from '../../booking/booking.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Gestão de Agendamentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
@Controller('appointments')
export class AppointmentController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar um novo agendamento administrativamente' })
  async create(@Req() req: any, @Body() body: any) {
    const barbershopId = req['barbershopId'];
    return this.bookingService.criarAgendamento(
      body.clientId,
      barbershopId,
      body.dateTime,
      body.serviceId,
      body.barberId,
      body.notes
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancelar um agendamento existente' })
  async cancel(@Req() req: any, @Param('id') id: string) {
    const barbershopId = req['barbershopId'];
    const appt = await this.prisma.appointment.findFirst({
      where: { id, barbershopId },
    });
    if (!appt) {
      throw new NotFoundException('Agendamento não encontrado nesta barbearia.');
    }
    return this.bookingService.cancelarAgendamento(appt.clientId, barbershopId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Remarcar um agendamento existente' })
  async reschedule(@Req() req: any, @Param('id') id: string, @Body('dateTime') dateTime: string) {
    const barbershopId = req['barbershopId'];
    const appt = await this.prisma.appointment.findFirst({
      where: { id, barbershopId },
    });
    if (!appt) {
      throw new NotFoundException('Agendamento não encontrado nesta barbearia.');
    }
    return this.bookingService.remarcarAgendamento(appt.clientId, barbershopId, id, dateTime);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status de um agendamento' })
  async updateStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: string) {
    const barbershopId = req['barbershopId'];
    const appt = await this.prisma.appointment.findFirst({
      where: { id, barbershopId },
    });
    if (!appt) {
      throw new NotFoundException('Agendamento não encontrado nesta barbearia.');
    }
    return this.prisma.appointment.update({
      where: { id, barbershopId },
      data: { status },
    });
  }
}
