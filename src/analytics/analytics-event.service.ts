import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsEventSource, Prisma } from '@prisma/client';
import { subDays } from 'date-fns';

@Injectable()
export class AnalyticsEventService {
  private readonly logger = new Logger(AnalyticsEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async track(params: {
    name: string;
    category?: string;
    label?: string;
    value?: number;
    metadata?: Record<string, unknown>;
    accountId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    pageUrl?: string;
    source?: AnalyticsEventSource;
  }) {
    return this.prisma.analyticsEvent.create({
      data: {
        name: params.name,
        category: params.category,
        label: params.label,
        value: params.value,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        accountId: params.accountId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        sessionId: params.sessionId,
        pageUrl: params.pageUrl,
        source: params.source || AnalyticsEventSource.FRONTEND,
      },
    });
  }

  async query(params: {
    name?: string;
    category?: string;
    source?: AnalyticsEventSource;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.name) where.name = params.name;
    if (params.category) where.category = params.category;
    if (params.source) where.source = params.source;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from)
        (where.createdAt as Record<string, unknown>).gte = params.from;
      if (params.to)
        (where.createdAt as Record<string, unknown>).lte = params.to;
    }

    const [events, total] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { account: { select: { email: true } } },
      }),
      this.prisma.analyticsEvent.count({ where }),
    ]);

    return {
      data: events,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async getEventSummary(from?: Date, to?: Date) {
    const fromDate = from || subDays(new Date(), 7);
    const toDate = to || new Date();

    const [topEvents, sources, total] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['name'],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: true,
        orderBy: { _count: { name: 'desc' } },
        take: 20,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['source'],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: true,
      }),
      this.prisma.analyticsEvent.count({
        where: { createdAt: { gte: fromDate, lte: toDate } },
      }),
    ]);

    return {
      total,
      topEvents: topEvents.map((e) => ({ name: e.name, count: e._count })),
      bySource: sources.map((s) => ({ source: s.source, count: s._count })),
    };
  }

  @Cron('0 * * * *')
  async cleanupOldEvents() {
    const cutoff = subDays(new Date(), 30);
    try {
      const result = await this.prisma.analyticsEvent.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(
          `Cleaned up ${result.count} analytics events older than 30 days`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to clean up old analytics events', error);
    }
  }
}
