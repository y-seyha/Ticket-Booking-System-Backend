/* eslint-disable */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import {
  NotificationType,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials not configured — push notifications disabled',
      );
      return;
    }

    try {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log('Firebase Admin initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin', error);
    }
  }

  async registerToken(accountId: string, token: string, platform = 'web') {
    await this.prisma.deviceToken.upsert({
      where: {
        accountId_token: { accountId, token },
      },
      update: { isActive: true, platform },
      create: { accountId, token, platform },
    });
  }

  async unregisterToken(accountId: string, token: string) {
    await this.prisma.deviceToken.updateMany({
      where: { accountId, token },
      data: { isActive: false },
    });
  }

  private async sendPush(
    accountId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    if (!this.firebaseApp) return;

    const tokens = await this.prisma.deviceToken.findMany({
      where: { accountId, isActive: true },
      select: { token: true },
    });

    if (!tokens.length) return;

    const registrationTokens = tokens.map((t) => t.token);

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: registrationTokens,
        notification: { title, body },
        data,
      });

      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];

        response.responses.forEach((resp, idx) => {
          if (
            !resp.success &&
            resp.error &&
            (resp.error.code ===
              'messaging/registration-token-not-registered' ||
              resp.error.code === 'messaging/invalid-registration-token')
          ) {
            invalidTokens.push(registrationTokens[idx]);
          }
        });

        if (invalidTokens.length > 0) {
          await this.prisma.deviceToken.updateMany({
            where: { token: { in: invalidTokens } },
            data: { isActive: false },
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to send push notification', error);
    }
  }

  private emitInApp(
    accountId: string,
    title: string,
    body: string,
    type: string,
    data?: Record<string, string>,
  ) {
    const notification = {
      id: crypto.randomUUID(),
      title,
      body,
      type,
      data,
      createdAt: new Date().toISOString(),
    };
    this.notificationGateway.emitNotification(accountId, notification);
  }

  private async persistNotification(
    accountId: string,
    type: NotificationType,
    channel: NotificationChannel,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    try {
      await this.prisma.notification.create({
        data: {
          accountId,
          type,
          channel,
          title,
          body,
          data: data ? JSON.parse(JSON.stringify(data)) : undefined,
        },
      });
    } catch (error) {
      this.logger.error('Failed to persist notification', error);
    }
  }

  private async notify(
    accountId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    await this.sendPush(accountId, title, body, data);

    this.emitInApp(accountId, title, body, type.toLowerCase(), data);
    await this.persistNotification(accountId, type, NotificationChannel.IN_APP, title, body, data);
  }

  async sendBookingConfirmation(accountId: string, bookingId: string) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          showtime: {
            include: {
              movie: true,
              screen: {
                include: { theater: true },
              },
            },
          },
          bookingSeats: {
            include: { seat: true },
          },
          foodItems: {
            include: { foodItem: true },
          },
        },
      });

      if (!booking) {
        this.logger.warn(`Booking ${bookingId} not found for notification`);
        return;
      }

      const { showtime, bookingSeats, foodItems } = booking;

      let body: string;
      let title: string;

      if (!showtime) {
        const foodLabels = foodItems
          .map((fi) => `${fi.foodItem.name} x${fi.quantity}`)
          .join(', ');
        title = 'Food Order Confirmed!';
        body = `Your food order — ${foodLabels} — is confirmed and ready for pickup.`;
      } else {
        const movieTitle = showtime.movie.title;
        const theaterName = showtime.screen.theater.name;
        const seatLabels = bookingSeats
          .map((bs) => `Row ${bs.seat.seatRow} - Seat ${bs.seat.seatNumber}`)
          .join(', ');

        title = 'Booking Confirmed!';
        body = `Your tickets for "${movieTitle}" at ${theaterName} - ${seatLabels} are confirmed.`;
        if (foodItems && foodItems.length > 0) {
          const foodLabels = foodItems
            .map((fi) => `${fi.foodItem.name} x${fi.quantity}`)
            .join(', ');
          body += ` Food: ${foodLabels}.`;
        }
      }

      const data = {
        type: 'booking_confirmation',
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
      };

      await this.notify(accountId, NotificationType.BOOKING_CONFIRMATION, title, body, data);
    } catch (error) {
      this.logger.error(
        'Failed to send booking confirmation notification',
        error,
      );
    }
  }

  async sendBookingCancellation(accountId: string, bookingId: string) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          showtime: { include: { movie: true } },
        },
      });

      if (!booking || !booking.showtime) return;

      const title = 'Booking Cancelled';
      const body = `Your booking for "${booking.showtime.movie.title}" has been cancelled.`;
      const data = { type: 'booking_cancellation', bookingId };

      await this.notify(accountId, NotificationType.BOOKING_CANCELLATION, title, body, data);
    } catch (error) {
      this.logger.error('Failed to send cancellation notification', error);
    }
  }

  async sendUpcomingShowtimeReminder(
    accountId: string,
    showtimeId: string,
  ) {
    try {
      const showtime = await this.prisma.showtime.findUnique({
        where: { id: showtimeId },
        include: {
          movie: true,
          screen: { include: { theater: true } },
        },
      });

      if (!showtime) return;

      const title = 'Upcoming Showtime';
      const body = `"${showtime.movie.title}" starts soon at ${showtime.screen.theater.name}!`;
      const data = { type: 'upcoming_showtime', showtimeId };

      await this.notify(accountId, NotificationType.UPCOMING_SHOWTIME, title, body, data);
    } catch (error) {
      this.logger.error('Failed to send upcoming showtime reminder', error);
    }
  }

  async getNotificationHistory(
    accountId: string,
    query: {
      status?: string;
      type?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { accountId };

    if (query.status === 'read') {
      where.readAt = { not: null };
    } else if (query.status === 'unread') {
      where.readAt = null;
    }

    if (query.type) {
      where.type = query.type as NotificationType;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(accountId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, accountId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(accountId: string) {
    await this.prisma.notification.updateMany({
      where: { accountId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(accountId: string) {
    return this.prisma.notification.count({
      where: { accountId, readAt: null },
    });
  }
}
