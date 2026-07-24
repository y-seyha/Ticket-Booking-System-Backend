import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { Roles } from '../authentication/decorators/role.decorator';
import { RolesGuard } from '../authentication/guards/roles.guard';

import { DashboardService } from './dashboard.service';
import { AnalyticsEventService } from './analytics-event.service';
import { ReportsService } from './reports.service';
import { Ga4Service } from './ga4.service';
import {
  DateRangeDto,
  AnalyticsEventQueryDto,
  TrackEventDto,
  ExportReportDto,
  Ga4WebhookDto,
} from './dto/analytics-query.dto';

@ApiTags('Analytics / Dashboard')
@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AnalyticsController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly analyticsEventService: AnalyticsEventService,
    private readonly reportsService: ReportsService,
    private readonly ga4Service: Ga4Service,
  ) {}

  @Get('dashboard/summary')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get main dashboard KPIs' })
  @ApiBearerAuth()
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('dashboard/revenue')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get revenue data with grouping' })
  @ApiBearerAuth()
  async getRevenue(@Query() query: DateRangeDto) {
    return this.dashboardService.getRevenueData(
      query.from,
      query.to,
      query.groupBy,
    );
  }

  @Get('dashboard/bookings')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get booking statistics' })
  @ApiBearerAuth()
  async getBookings(@Query() query: DateRangeDto) {
    return this.dashboardService.getBookingStats(query.from, query.to);
  }

  @Get('dashboard/users')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiBearerAuth()
  async getUsers(@Query() query: DateRangeDto) {
    return this.dashboardService.getUserStats(query.from, query.to);
  }

  @Get('dashboard/movies')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get movie performance ranking' })
  @ApiBearerAuth()
  async getMovies(@Query() query: DateRangeDto) {
    return this.dashboardService.getMoviePerformance(query.from, query.to);
  }

  @Get('dashboard/food-beverage')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get food & beverage sales' })
  @ApiBearerAuth()
  async getFoodBeverage(@Query() query: DateRangeDto) {
    return this.dashboardService.getFoodBeverageStats(query.from, query.to);
  }

  @Get('dashboard/occupancy')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get seat occupancy data' })
  @ApiBearerAuth()
  async getOccupancy(@Query() query: DateRangeDto) {
    return this.dashboardService.getOccupancyData(query.from, query.to);
  }

  @Get('dashboard/peak-times')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get peak booking times analysis' })
  @ApiBearerAuth()
  async getPeakTimes(@Query() query: DateRangeDto) {
    return this.dashboardService.getPeakTimes(query.from, query.to);
  }

  @Post('analytics/track')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track a user interaction event' })
  async trackEvent(@Body() dto: TrackEventDto, @Req() req: Request) {
    const user = (req as any).user;
    const event = await this.analyticsEventService.track({
      name: dto.name,
      category: dto.category,
      label: dto.label,
      value: dto.value,
      metadata: dto.metadata,
      accountId: user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: dto.sessionId,
      pageUrl: dto.pageUrl,
    });

    await this.ga4Service.sendEvent({
      eventName: dto.name,
      clientId: user?.id || `anon-${req.ip}`,
      userId: user?.id,
      params: {
        category: dto.category,
        label: dto.label,
        value: dto.value,
        ...dto.metadata,
      },
    });

    return { id: event.id, success: true };
  }

  @Post('analytics/webhook/ga4')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive GA4 webhook events' })
  async receiveGa4Webhook(
    @Body() dto: Ga4WebhookDto,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    if (dto.events) {
      for (const ga4Event of dto.events) {
        const mapped = this.ga4Service.mapWebhookEventToAnalytics(
          ga4Event as { name: string; params?: Record<string, unknown> },
        );
        await this.analyticsEventService.track({
          ...mapped,
          source: 'GA4_WEBHOOK',
          sessionId: dto.client_id,
          accountId: dto.user_id,
        });
      }
    }

    return { received: dto.events?.length || 0 };
  }

  @Get('analytics/events')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Query tracked analytics events' })
  @ApiBearerAuth()
  async getEvents(@Query() query: AnalyticsEventQueryDto) {
    return this.analyticsEventService.query({
      name: query.name,
      category: query.category,
      source: query.source,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page || 1,
      limit: query.limit || 20,
    });
  }

  @Get('analytics/events/summary')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get event tracking summary' })
  @ApiBearerAuth()
  async getEventSummary(@Query() query: DateRangeDto) {
    return this.analyticsEventService.getEventSummary(
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('analytics/reports/export')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Export report as CSV' })
  @ApiBearerAuth()
  async exportReport(@Query() query: ExportReportDto, @Res() res: Response) {
    const result = await this.reportsService.exportCsv({
      type: query.type,
      from: query.from,
      to: query.to,
      groupBy: query.groupBy,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.csv);
  }
}
