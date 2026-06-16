import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIContextService } from './ai-context.service';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [BookingModule],
  providers: [AIService, AIContextService],
  exports: [AIService, AIContextService],
})
export class AIModule {}
