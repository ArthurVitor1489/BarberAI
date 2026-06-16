import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { OutboxProcessorService } from './outbox-processor.service';

@Global()
@Module({
  providers: [PrismaService, AuditService, OutboxProcessorService],
  exports: [PrismaService, AuditService, OutboxProcessorService],
})
export class DatabaseModule {}
