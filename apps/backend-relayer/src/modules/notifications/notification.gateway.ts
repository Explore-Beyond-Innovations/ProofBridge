import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Notification } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { env } from '@libs/configs';

// Namespace keeps notifications traffic isolated from any other WS surface
// we might add later. Auth is performed at handshake time using the same
// JWT that the HTTP guard verifies (see UserJwtGuard) — the frontend passes
// the access token via `io(url, { auth: { token } })`.
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.debug(
        `Rejecting ${client.id}: missing token in handshake auth`,
      );
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        { secret: env.jwt.secret },
      );
      const userId = payload.sub;
      if (!userId) {
        client.disconnect(true);
        return;
      }
      client.data.userId = userId;
      await client.join(this.roomFor(userId));
      this.logger.debug(`Connected ${client.id} → user:${userId}`);
    } catch (err) {
      this.logger.debug(
        `Rejecting ${client.id}: invalid token (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: string } | undefined)?.userId;
    if (userId) {
      this.logger.debug(`Disconnected ${client.id} (user:${userId})`);
    }
  }

  pushToUser(userId: string, notification: Notification): void {
    if (!this.server) return;
    this.server
      .to(this.roomFor(userId))
      .emit('notification', notification);
  }

  private roomFor(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (auth && typeof auth.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }
    // Fallback: `Authorization: Bearer <token>` header, matches HTTP guard.
    const header = client.handshake.headers['authorization'];
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return null;
  }
}
