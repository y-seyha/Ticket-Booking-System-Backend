import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';

const CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
];

// Define a type for your socket's custom data to avoid unsafe member access
interface CustomSocket extends Socket {
  data: {
    user?: {
      id?: string;
      email?: string;
    };
  };
}

@WebSocketGateway({
  namespace: '/seats',
  cors: {
    origin: CORS_ORIGINS,
    credentials: true,
  },
})
export class SeatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly configService: ConfigService) {}

  async handleConnection(client: CustomSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);

      if (!token) return;

      const { verify } = await import('jsonwebtoken');
      const secret = this.configService.get<string>('JWT_SECRET');

      if (!secret) return;

      const decoded = verify(token, secret) as {
        sub?: string;
        id?: string;
        email?: string;
      };

      client.data.user = {
        id: decoded.sub || decoded.id,
        email: decoded.email,
      };
    } catch {
      // Unauthenticated connections can still view seat maps
    }
  }

  // ESLint warned about unused parameters.
  // If the method is required by the interface but unused, omit the parameter names entirely or remove it.
  handleDisconnect() {}

  @SubscribeMessage('joinShowtime')
  handleJoinShowtime(client: Socket, showtimeId: string) {
    // Explicitly marking these Promises as ignored with the `void` operator
    void client.join(`showtime:${showtimeId}`);
    return { event: 'joined', data: { showtimeId } };
  }

  @SubscribeMessage('leaveShowtime')
  handleLeaveShowtime(client: Socket, showtimeId: string) {
    // Explicitly marking these Promises as ignored with the `void` operator
    void client.leave(`showtime:${showtimeId}`);
  }

  emitSeatLocked(showtimeId: string, seatId: string) {
    this.server
      .to(`showtime:${showtimeId}`)
      .emit('seat:locked', { seatId, showtimeId });
  }

  emitSeatUnlocked(showtimeId: string, seatId: string) {
    this.server
      .to(`showtime:${showtimeId}`)
      .emit('seat:unlocked', { seatId, showtimeId });
  }

  emitSeatsBooked(showtimeId: string, seatIds: string[]) {
    this.server
      .to(`showtime:${showtimeId}`)
      .emit('seat:booked', { seatIds, showtimeId });
  }

  emitSeatsExpired(showtimeId: string, seatIds: string[]) {
    this.server
      .to(`showtime:${showtimeId}`)
      .emit('seat:expired', { seatIds, showtimeId });
  }
}
