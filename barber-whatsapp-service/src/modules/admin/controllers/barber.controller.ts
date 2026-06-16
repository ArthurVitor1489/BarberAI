import { Controller, Get, Post, Body, Param, Put, Delete, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../database/audit.service';
import { CreateBarberDto, UpdateBarberDto } from '../dto/barber.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Gestão de Barbeiros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
@Controller('barbers')
export class BarberController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Adicionar um novo barbeiro à equipe (Disponível apenas para OWNER e MANAGER)' })
  @ApiResponse({ status: 201, description: 'Barbeiro adicionado com sucesso.' })
  async create(@Req() req: any, @Body() dto: CreateBarberDto) {
    const barbershopId = req['barbershopId'];
    
    const barber = await this.prisma.barber.create({
      data: {
        name: dto.name,
        specialty: dto.specialty,
        photo: dto.photo,
        active: dto.active !== undefined ? dto.active : true,
        barbershopId,
        workingHours: dto.workingHours ? {
          createMany: {
            data: dto.workingHours.map((wh) => ({
              dayOfWeek: wh.dayOfWeek,
              startTime: wh.startTime,
              endTime: wh.endTime,
            })),
          }
        } : undefined,
      },
    });

    await this.auditService.log('CREATE', 'Barber', barber.id, req.user?.sub, barbershopId);
    return barber;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter dados completos de um barbeiro por ID' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    const barbershopId = req['barbershopId'];
    return this.prisma.barber.findFirstOrThrow({
      where: { id, barbershopId, deletedAt: null },
      include: { workingHours: true },
    });
  }

  @Put(':id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Atualizar informações cadastrais do barbeiro' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBarberDto) {
    const barbershopId = req['barbershopId'];
    
    const barber = await this.prisma.barber.update({
      where: { id },
      data: {
        name: dto.name,
        specialty: dto.specialty,
        photo: dto.photo,
        active: dto.active,
      },
    });

    await this.auditService.log('UPDATE', 'Barber', barber.id, req.user?.sub, barbershopId);
    return barber;
  }

  @Delete(':id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Remover logicamente (Soft Delete) um barbeiro da equipe' })
  async remove(@Req() req: any, @Param('id') id: string) {
    const barbershopId = req['barbershopId'];
    
    // Executa Soft Delete em vez de remoção física (Fase 4 / Soft Delete)
    const barber = await this.prisma.barber.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log('DELETE', 'Barber', barber.id, req.user?.sub, barbershopId);
    return { success: true, message: 'Barbeiro removido com sucesso.' };
  }
}
