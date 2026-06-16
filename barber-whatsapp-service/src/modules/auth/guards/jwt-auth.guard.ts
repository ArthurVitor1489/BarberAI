import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso não fornecido.');
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });

      // Invalidação Global de Sessões (Fase 1 / JWT Versioning)
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Esta sessão foi invalidada ou a senha foi alterada.');
      }

      request.user = payload;
      
      // Injeta automaticamente o barbershopId da sessão no request para o TenantMiddleware/Controllers
      request['barbershopId'] = payload.barbershopId;
      
      return true;
    } catch (err) {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }
  }
}
