import { Controller, Get, Put, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OwnershipGuard } from '../../auth/guards/ownership.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Configurações & Assinatura')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
@Controller()
export class BarbershopController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('barbershop')
  @ApiOperation({ summary: 'Obter dados da barbearia do inquilino logado' })
  async getBarbershop(@Req() req: any) {
    const barbershopId = req['barbershopId'];
    return this.prisma.barbershop.findUniqueOrThrow({
      where: { id: barbershopId },
    });
  }

  @Put('barbershop')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Atualizar dados cadastrais da barbearia' })
  async updateBarbershop(@Req() req: any, @Body() body: any) {
    const barbershopId = req['barbershopId'];
    
    if (!body.name || !body.phone || !body.email) {
      throw new BadRequestException('Nome, telefone e e-mail são obrigatórios.');
    }

    return this.prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        address: body.address || '',
        workingHours: body.workingHours || '09:00-18:00',
        timezone: body.timezone || 'America/Sao_Paulo',
      },
    });
  }

  @Get('whatsapp/instances')
  @ApiOperation({ summary: 'Obter instâncias de WhatsApp conectadas para a barbearia' })
  async getWhatsAppInstances(@Req() req: any) {
    const barbershopId = req['barbershopId'];
    return this.prisma.whatsAppInstance.findMany({
      where: { barbershopId },
    });
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Obter dados de assinatura ativos do inquilino' })
  async getSubscription(@Req() req: any) {
    const barbershopId = req['barbershopId'];
    const sub = await this.prisma.subscription.findUnique({
      where: { barbershopId },
    });

    if (!sub) {
      return {
        plan: 'STARTER',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }
    return sub;
  }
}
