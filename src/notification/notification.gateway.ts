import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';

function getCorsOrigins(): string[] {
  const origins = process.env.CORS_ORIGINS;
  if (origins) {
    return origins.split(',').map((o) => o.trim());
  }
  const frontendUrl = process.env.FRONTEND_URL;
  const backendUrl = process.env.BACKEND_URL;
  const originsList: string[] = [];
  if (backendUrl) originsList.push(backendUrl);
  if (frontendUrl) originsList.push(frontendUrl);
  if (originsList.length === 0) {
    originsList.push('http://localhost:3001');
  }
  return originsList;
}

interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      id: string;
      email?: string;
    };
  };
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly configService: ConfigService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      let token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);

      if (!token) {
        const raw = client.handshake.headers.cookie || '';
        const match = raw.match(/(?:^|;\s*)access_token=([^;]+)/);
        if (match) token = match[1];
      }

      if (!token) {
        client.disconnect();
        return;
      }

      const { verify } = await import('jsonwebtoken');
      const secret = this.configService.get<string>('JWT_SECRET');

      if (!secret) {
        client.disconnect();
        return;
      }

      const decoded = verify(token, secret) as {
        sub?: string;
        id?: string;
      };

      const userId = decoded.sub || decoded.id;
      if (!userId) {
        client.disconnect();
        return;
      }

      client.data.user = { id: userId };
      await client.join(`notification:${userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect() {}

  @SubscribeMessage('ping')
  handlePing(client: AuthenticatedSocket) {
    return { event: 'pong', data: {} };
  }

  emitNotification(
    accountId: string,
    notification: {
      id: string;
      title: string;
      body: string;
      type: string;
      data?: Record<string, string>;
      createdAt: string;
    },
  ) {
    this.server
      .to(`notification:${accountId}`)
      .emit('notification:new', notification);
  }
}
