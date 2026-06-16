import { Controller, Get, Post, Body, Param, Put, Delete, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../database/audit.service';
import { CreateServiceDto, UpdateServiceDto } from '../dto/service.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Gestão de Serviços')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
@Controller('services')
export class ServiceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Cadastrar um novo serviço de barbearia (Disponível apenas para OWNER e MANAGER)' })
  @ApiResponse({ status: 201, description: 'Serviço cadastrado com sucesso.' })
  async create(@Req() req: any, @Body() dto: CreateServiceDto) {
    const barbershopId = req['barbershopId'];
    
    const service = await this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        durationMinutes: dto.durationMinutes || 30,
        active: dto.active !== undefined ? dto.active : true,
        barbershopId,
      },
    });

    await this.auditService.log('CREATE', 'Service', service.id, req.user?.sub, barbershopId);
    return service;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes de um serviço por ID' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    const barbershopId = req['barbershopId'];
    return this.prisma.service.findFirstOrThrow({
      where: { id, barbershopId, deletedAt: null },
    });
  }

  @Put(':id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Atualizar informações e preço do serviço' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    const barbershopId = req['barbershopId'];
    
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        active: dto.active,
      },
    });

    await this.auditService.log('UPDATE', 'Service', service.id, req.user?.sub, barbershopId);
    return service;
  }

  @Delete(':id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Remover logicamente (Soft Delete) um serviço' })
  async remove(@Req() req: any, @Param('id') id: string) {
    const barbershopId = req['barbershopId'];
    
    // Executa Soft Delete em vez de remoção física (Fase 4 / Soft Delete)
    const service = await this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log('DELETE', 'Service', service.id, req.user?.sub, barbershopId);
    return { success: true, message: 'Serviço removido com sucesso.' };
  }
}
