import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class Ga4Service {
  private readonly logger = new Logger(Ga4Service.name);
  private readonly measurementId: string | undefined;
  private readonly apiSecret: string | undefined;
  private readonly webhookSecret: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.measurementId = this.configService.get<string>('GA4_MEASUREMENT_ID');
    this.apiSecret = this.configService.get<string>('GA4_API_SECRET');
    this.webhookSecret = this.configService.get<string>('GA4_WEBHOOK_SECRET');
  }

  get isConfigured(): boolean {
    return !!(this.measurementId && this.apiSecret);
  }

  validateWebhook(
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    if (!this.webhookSecret) return false;
    const signature =
      headers['x-ga4-webhook-signature'] ||
      headers['x-webhook-signature'] ||
      '';
    return signature === this.webhookSecret;
  }

  async sendEvent(params: {
    eventName: string;
    clientId?: string;
    userId?: string;
    params?: Record<string, unknown>;
  }) {
    if (!this.isConfigured) {
      this.logger.warn('GA4 not configured — skipping event send');
      return;
    }

    try {
      await axios.post(
        `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        {
          client_id: params.clientId || 'backend-server',
          user_id: params.userId,
          events: [
            {
              name: params.eventName,
              params: {
                session_id: `backend-${Date.now()}`,
                engagement_time_msec: 1,
                ...params.params,
              },
            },
          ],
        },
      );
    } catch (error) {
      this.logger.error('Failed to send GA4 event', error);
    }
  }

  async sendEventsBatch(
    events: Array<{
      eventName: string;
      clientId?: string;
      userId?: string;
      params?: Record<string, unknown>;
    }>,
  ) {
    if (!this.isConfigured) return;

    try {
      await axios.post(
        `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`,
        {
          client_id: 'backend-server',
          events: events.map((e) => ({
            name: e.eventName,
            params: {
              session_id: `backend-${Date.now()}`,
              engagement_time_msec: 1,
              ...e.params,
            },
          })),
        },
      );
    } catch (error) {
      this.logger.error('Failed to send GA4 batch events', error);
    }
  }

  mapWebhookEventToAnalytics(ga4Event: {
    name: string;
    params?: Record<string, unknown>;
  }) {
    return {
      name: ga4Event.name,
      category: 'ga4_webhook',
      label:
        (ga4Event.params?.page_title as string) ||
        (ga4Event.params?.page_location as string) ||
        undefined,
      value:
        typeof ga4Event.params?.value === 'number'
          ? ga4Event.params.value
          : undefined,
      metadata: ga4Event.params,
      pageUrl: ga4Event.params?.page_location as string | undefined,
    };
  }
}
