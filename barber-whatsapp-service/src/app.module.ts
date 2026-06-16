import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './modules/database/database.module';
import { BookingModule } from './modules/booking/booking.module';
import { AIModule } from './modules/ai/ai.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { AdminModule } from './modules/admin/admin.module';
import { CRMModule } from './modules/crm/crm.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { HealthModule } from './modules/health/health.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { LoggingMiddleware } from './common/middleware/logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    BookingModule,
    AIModule,
    WhatsappModule,
    AdminModule,
    CRMModule,
    SubscriptionModule,
    RedisModule,
    AuthModule,
    MetricsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggingMiddleware, TenantMiddleware)
      .forRoutes('*');
  }
}
