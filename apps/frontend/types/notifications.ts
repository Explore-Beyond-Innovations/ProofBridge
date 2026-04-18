export type NotificationType =
  | "TRADE_CREATED"
  | "TRADE_LOCKED"
  | "BRIDGER_CLAIMED";

export interface INotification {
  id: string;
  userId: string;
  type: NotificationType;
  tradeId: string | null;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface IListNotificationsParams {
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export interface IListNotificationsResponse {
  items: INotification[];
  nextCursor: string | null;
}
