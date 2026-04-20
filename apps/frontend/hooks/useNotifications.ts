import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications.service";
import { IListNotificationsParams } from "@/types/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthToken } from "./useAuthToken";

export const NOTIFICATIONS_LIST_KEY = ["notifications", "list"] as const;
export const NOTIFICATIONS_UNREAD_COUNT_KEY = [
  "notifications",
  "unread-count",
] as const;

export const useGetAllNotifications = (
  params: IListNotificationsParams = {},
) => {
  const token = useAuthToken();
  return useQuery({
    queryKey: [...NOTIFICATIONS_LIST_KEY, params],
    queryFn: () => listNotifications(params),
    enabled: Boolean(token),
  });
};

export const useGetUnreadCount = () => {
  const token = useAuthToken();
  return useQuery({
    queryKey: NOTIFICATIONS_UNREAD_COUNT_KEY,
    queryFn: () => getUnreadCount(),
    enabled: Boolean(token),
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["mark-notification-read"],
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_KEY }),
        queryClient.invalidateQueries({
          queryKey: NOTIFICATIONS_UNREAD_COUNT_KEY,
        }),
      ]);
    },
    onError: function (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Unable to mark notification as read",
      );
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["mark-all-notifications-read"],
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_KEY }),
        queryClient.invalidateQueries({
          queryKey: NOTIFICATIONS_UNREAD_COUNT_KEY,
        }),
      ]);
    },
    onError: function (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Unable to mark notifications as read",
      );
    },
  });
};
