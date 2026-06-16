import { Module, Global } from '@nestjs/common';
import { FeatureService } from './feature.service';

@Global()
@Module({
  providers: [FeatureService],
  exports: [FeatureService],
})
export class SubscriptionModule {}
