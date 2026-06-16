import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava uma entrada de auditoria na tabela AuditLog
   */
  async log(action: string, entity: string, entityId: string, userId: string | null, barbershopId: string, tx?: any) {
    const client = tx || this.prisma;
    return client.auditLog.create({
      data: {
        action,     // CREATE, UPDATE, DELETE, CANCEL
        entity,     // Ex: Appointment, Service, Barber, Client
        entityId,
        userId,
        barbershopId,
      },
    });
  }
}
