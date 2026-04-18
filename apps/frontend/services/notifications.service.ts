import { urls } from "@/utils/urls";
import { api } from "./api.instance";
import {
  IListNotificationsParams,
  IListNotificationsResponse,
  INotification,
} from "@/types/notifications";

const route = (path = "") => `${urls.API_URL}/v1/notifications${path}`;

export const listNotifications = async (
  params: IListNotificationsParams = {},
): Promise<IListNotificationsResponse> => {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
  );
  const response = await api.get(route(), { params: cleaned });
  return response.data as IListNotificationsResponse;
};

export const getUnreadCount = async (): Promise<number> => {
  const response = await api.get(route("/unread-count"));
  return (response.data as { count: number }).count;
};

export const markNotificationRead = async (
  id: string,
): Promise<INotification> => {
  const response = await api.patch(route(`/${id}/read`));
  return response.data as INotification;
};

export const markAllNotificationsRead = async (): Promise<number> => {
  const response = await api.post(route("/read-all"));
  return (response.data as { updated: number }).updated;
};
