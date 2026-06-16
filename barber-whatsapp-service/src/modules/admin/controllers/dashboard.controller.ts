import { Controller, Get, Query, Req, UseGuards, Param } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Dashboard Administrativo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Obter painel analítico com faturamento e volume de agendamentos' })
  async getDashboard(@Req() req: any) {
    const barbershopId = req['barbershopId'];
    return this.dashboardService.getDashboardSummary(barbershopId);
  }

  @Get('appointments')
  @ApiOperation({ summary: 'Listar agendamentos do inquilino com paginação e filtros de data, status ou profissional' })
  async getAppointments(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('barberId') barberId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const barbershopId = req['barbershopId'];
    return this.dashboardService.getAppointments(barbershopId, {
      date,
      barberId,
      status,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('customers')
  @ApiOperation({ summary: 'Listar clientes cadastrados e pontuações de LTV com paginação e filtros' })
  async getCustomers(
    @Req() req: any,
    @Query('name') name?: string,
    @Query('phone') phone?: string,
    @Query('frequency') frequency?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const barbershopId = req['barbershopId'];
    return this.dashboardService.getCustomers(barbershopId, {
      name,
      phone,
      frequency,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Obter perfil completo de um cliente específico' })
  async getCustomer(@Req() req: any, @Param('id') id: string) {
    const barbershopId = req['barbershopId'];
    return this.prisma.client.findFirstOrThrow({
      where: { id, barbershopId },
      include: {
        customerProfile: {
          include: {
            favoriteBarber: true,
            favoriteService: true,
          },
        },
        appointments: {
          where: { deletedAt: null },
          include: { service: true, barber: true },
          orderBy: { dateTime: 'desc' },
        },
      },
    });
  }

  @Get('barbers')
  @ApiOperation({ summary: 'Listar todos os profissionais da barbearia (Ignora removidos)' })
  async getBarbers(@Req() req: any) {
    const barbershopId = req['barbershopId'];
    return this.prisma.barber.findMany({
      where: { barbershopId, deletedAt: null },
      include: { workingHours: true },
    });
  }

  @Get('services')
  @ApiOperation({ summary: 'Listar todos os serviços de corte/barba cadastrados (Ignora removidos)' })
  async getServices(@Req() req: any) {
    const barbershopId = req['barbershopId'];
    return this.prisma.service.findMany({
      where: { barbershopId, deletedAt: null },
    });
  }
}
