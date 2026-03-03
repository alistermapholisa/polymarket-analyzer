import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export interface Notification {
  id: number;
  marketId: number | null;
  type: "THRESHOLD_CROSSED" | "MOVEMENT_DETECTED" | "PREDICTION_RESOLVED" | "ACCURACY_UPDATE";
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "ALERT" | null;
  isRead: boolean | null;
  createdAt: Date;
  metadata?: Record<string, unknown> | null;
}

/**
 * Hook for managing notifications
 * Handles fetching, marking as read, and real-time updates
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  const { data: notificationsData, refetch } = trpc.notifications.list.useQuery(
    { limit: 50, unreadOnly: false },
    { enabled: true }
  );

  // Mark as read mutation
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Update notifications when data changes
  useEffect(() => {
    if (notificationsData) {
      setNotifications(
        notificationsData.map((n) => ({
          ...n,
          createdAt: new Date(n.createdAt),
        }))
      );

      // Count unread
      const unread = notificationsData.filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    }
  }, [notificationsData]);

  const markAsRead = useCallback(
    (notificationId: number) => {
      markReadMutation.mutate({ notificationId });
    },
    [markReadMutation]
  );

  const markAllAsRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isLoading: markReadMutation.isPending || markAllReadMutation.isPending,
  };
}
