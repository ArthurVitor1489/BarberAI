import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Se o usuário não estiver autenticado ou não tiver barbearia associada
    if (!user || !user.barbershopId) {
      return false;
    }

    const { id } = request.params;
    if (!id) {
      return true; // Se não houver ID específico na rota, a validação de propriedade não se aplica
    }

    const path = request.route.path;

    try {
      // Prevenção de IDOR para Barbeiros (Fase 3)
      if (path.includes('/barbers/:id')) {
        const barber = await this.prisma.barber.findUnique({ where: { id } });
        if (!barber || barber.deletedAt) throw new NotFoundException('Barbeiro não encontrado.');
        if (barber.barbershopId !== user.barbershopId) {
          throw new ForbiddenException('Acesso negado: Este recurso pertence a outra empresa.');
        }
      } 
      // Prevenção de IDOR para Serviços (Fase 3)
      else if (path.includes('/services/:id')) {
        const service = await this.prisma.service.findUnique({ where: { id } });
        if (!service || service.deletedAt) throw new NotFoundException('Serviço não encontrado.');
        if (service.barbershopId !== user.barbershopId) {
          throw new ForbiddenException('Acesso negado: Este recurso pertence a outra empresa.');
        }
      } 
      // Prevenção de IDOR para Agendamentos (Fase 3)
      else if (path.includes('/appointments/:id')) {
        const appt = await this.prisma.appointment.findUnique({ where: { id } });
        if (!appt || appt.deletedAt) throw new NotFoundException('Agendamento não encontrado.');
        if (appt.barbershopId !== user.barbershopId) {
          throw new ForbiddenException('Acesso negado: Este recurso pertence a outra empresa.');
        }
      } 
      // Prevenção de IDOR para Conversas (Fase 3)
      else if (path.includes('/conversation/:id')) {
        const conv = await this.prisma.conversation.findUnique({ where: { id } });
        if (!conv) throw new NotFoundException('Conversa não encontrada.');
        if (conv.barbershopId !== user.barbershopId) {
          throw new ForbiddenException('Acesso negado: Este recurso pertence a outra empresa.');
        }
      }
      return true;
    } catch (err: any) {
      if (err instanceof ForbiddenException || err instanceof NotFoundException) {
        throw err;
      }
      return false;
    }
  }
}
