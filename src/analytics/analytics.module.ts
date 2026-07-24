import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { DashboardService } from './dashboard.service';
import { AnalyticsEventService } from './analytics-event.service';
import { ReportsService } from './reports.service';
import { Ga4Service } from './ga4.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    DashboardService,
    AnalyticsEventService,
    ReportsService,
    Ga4Service,
  ],
  exports: [AnalyticsEventService, Ga4Service],
})
export class AnalyticsModule {}
