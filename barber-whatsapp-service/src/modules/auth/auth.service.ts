import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Criptografa o token refresh usando SHA-256 para evitar vazamento em caso de dump do banco
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Registra um novo usuário no SaaS multi-tenant
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException('E-mail já está em uso.');
    }

    const barbershop = await this.prisma.barbershop.findUnique({
      where: { id: dto.barbershopId },
    });

    if (!barbershop) {
      throw new BadRequestException('Barbearia informada não existe.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
        barbershopId: dto.barbershopId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        barbershopId: true,
        createdAt: true,
      },
    });
  }

  /**
   * Autentica o usuário e cria uma nova sessão de dispositivo
   */
  async login(dto: LoginDto, device: string = 'Unknown', ip: string = '127.0.0.1') {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    // Gera o Access Token contendo userId, role, tenant e a versão atual do token
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      barbershopId: user.barbershopId,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    // Gera o Refresh Token
    const refreshTokenPayload = { sub: user.id };
    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const refreshTokenHash = this.hashToken(refreshToken);

    // Persiste a sessão do dispositivo no banco
    await this.prisma.session.create({
      data: {
        userId: user.id,
        device,
        ip,
        refreshTokenHash,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        barbershopId: user.barbershopId,
      },
    };
  }

  /**
   * Rotaciona as chaves gerando novas credenciais a partir do Refresh Token
   */
  async refresh(refreshToken: string, device: string = 'Unknown', ip: string = '127.0.0.1') {
    let payload: any;

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (err) {
      throw new UnauthorizedException('Refresh Token inválido ou expirado.');
    }

    const currentHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: currentHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Sessão ativa não encontrada.');
    }

    const user = session.user;

    // Gera novo Access Token
    const accessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      barbershopId: user.barbershopId,
      tokenVersion: user.tokenVersion,
    };

    const newAccessToken = this.jwtService.sign(accessTokenPayload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    // Gera novo Refresh Token (Rotação)
    const newRefreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    const newHash = this.hashToken(newRefreshToken);

    // Atualiza a sessão antiga com o novo hash do token rotacionado
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newHash,
        lastSeenAt: new Date(),
        device,
        ip,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revoga a sessão de dispositivo correspondente (Logout)
   */
  async logout(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    try {
      await this.prisma.session.delete({
        where: { refreshTokenHash: hash },
      });
    } catch (err) {
      // Ignora erro se a sessão já tiver sido deletada/expirada
    }
    return { success: true };
  }

  /**
   * Invalidação Global de Sessões (Incrementa a versão do token)
   */
  async invalidateAllSessions(userId: string) {
    // 1. Incrementa a versão do token do usuário
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 },
      },
    });

    // 2. Remove todas as sessões físicas persistidas dele
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    return { success: true };
  }
}
