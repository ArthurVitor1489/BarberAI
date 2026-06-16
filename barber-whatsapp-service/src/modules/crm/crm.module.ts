import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CRMService } from './crm.service';
import { CampaignScheduler } from './campaign.scheduler';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    WhatsappModule,
  ],
  providers: [CRMService, CampaignScheduler],
  exports: [CRMService, CampaignScheduler],
})
export class CRMModule {}
