import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * Notification bell icon with unread count badge
 * Displays in header and navigates to notifications page
 */
export function NotificationBell() {
  const [, setLocation] = useLocation();
  const { unreadCount } = useNotifications();

  return (
    <button
      onClick={() => setLocation("/notifications")}
      className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
