import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards, Ip, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';

@ApiTags('Autenticação & Sessões')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar um novo usuário administrativo (Tenant/Barbearia)' })
  @ApiResponse({ status: 201, description: 'Usuário registrado com sucesso.' })
  @ApiResponse({ status: 400, description: 'E-mail em uso ou dados inválidos.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Rate Limiting (50 requisições por minuto no fluxo de login para desenvolvimento)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuário administrativo (Login)' })
  @ApiResponse({ status: 200, description: 'Autenticado com sucesso. Retorna tokens de acesso e refresh.' })
  @ApiResponse({ status: 401, description: 'E-mail ou senha incorretos.' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(dto, userAgent || 'Unknown', ip);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotacionar chaves de acesso usando Refresh Token' })
  @ApiResponse({ status: 200, description: 'Tokens rotacionados com sucesso.' })
  @ApiResponse({ status: 401, description: 'Refresh Token expirado ou inválido.' })
  async refresh(
    @Body('refreshToken') refreshToken: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    if (!refreshToken) {
      throw new BadRequestException('Propriedade refreshToken é obrigatória.');
    }
    return this.authService.refresh(refreshToken, userAgent || 'Unknown', ip);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revogar sessão do dispositivo atual (Logout)' })
  @ApiResponse({ status: 200, description: 'Logout efetuado com sucesso.' })
  async logout(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Propriedade refreshToken é obrigatória.');
    }
    return this.authService.logout(refreshToken);
  }

  @Post('invalidate-all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidação Global de Sessões (Desconectar de todos os dispositivos)' })
  @ApiResponse({ status: 200, description: 'Todas as sessões foram revogadas com sucesso.' })
  async invalidateAll(@Req() req: any) {
    // req.user injetado pelo JwtAuthGuard (que criaremos a seguir)
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.authService.invalidateAllSessions(userId);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todas as sessões de dispositivos ativas do usuário' })
  async getSessions(@Req() req: any) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.prisma.session.findMany({
      where: { userId },
      select: {
        id: true,
        device: true,
        ip: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revogar remotamente uma sessão de dispositivo específica' })
  async revokeSession(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }
    
    // Garante propriedade da sessão antes de apagar
    const session = await this.prisma.session.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new BadRequestException('Sessão não encontrada ou não pertence ao usuário.');
    }

    await this.prisma.session.delete({
      where: { id },
    });

    return { success: true };
  }
}

// Injeta BadRequestException e UnauthorizedException importações que faltavam
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
