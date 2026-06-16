import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { BarberController } from './controllers/barber.controller';
import { ServiceController } from './controllers/service.controller';
import { AppointmentController } from './controllers/appointment.controller';
import { BarbershopController } from './controllers/barbershop.controller';
import { PilotController } from './controllers/pilot.controller';
import { DashboardService } from './services/dashboard.service';
import { MetricsService } from './services/metrics.service';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [BookingModule],
  controllers: [DashboardController, BarberController, ServiceController, AppointmentController, BarbershopController, PilotController],
  providers: [DashboardService, MetricsService],
  exports: [DashboardService, MetricsService],
})
export class AdminModule {}
