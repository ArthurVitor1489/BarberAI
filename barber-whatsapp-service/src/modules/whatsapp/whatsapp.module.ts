import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { ConversationController } from './conversation.controller';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [WhatsappController, ConversationController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
