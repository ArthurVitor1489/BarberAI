import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processOutbox() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const events = await this.prisma.eventOutbox.findMany({
        where: { status: 'PENDING' },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });

      for (const event of events) {
        try {
          const parsedPayload = JSON.parse(event.payload);
          await this.eventEmitter.emitAsync(event.eventType, parsedPayload);

          await this.prisma.eventOutbox.update({
            where: { id: event.id },
            data: {
              status: 'PROCESSED',
              processedAt: new Date(),
            },
          });
        } catch (eventError: any) {
          this.logger.error(`Error processing outbox event ${event.id}: ${eventError.message}`);
          await this.prisma.eventOutbox.update({
            where: { id: event.id },
            data: { status: 'FAILED' },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Error fetching outbox events: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
