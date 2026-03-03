import { useState, useCallback, useEffect } from "react";
import { NotificationToast } from "./NotificationToast";

export interface Toast {
  id: string;
  title: string;
  message: string;
  severity?: "INFO" | "WARNING" | "ALERT" | "SUCCESS";
  duration?: number;
}

/**
 * Container component for managing and displaying toast notifications
 * Can be used globally in the app to show temporary alerts
 */
export function NotificationContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Expose globally for easy access
  useEffect(() => {
    (window as any).showNotification = addToast;
  }, [addToast]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {toasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          {...toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
}

/**
 * Helper function to show a notification toast globally
 * Usage: showNotification({ title: "Success", message: "Market updated", severity: "SUCCESS" })
 */
export function showNotification(toast: Omit<Toast, "id">) {
  if (typeof window !== "undefined" && (window as any).showNotification) {
    (window as any).showNotification(toast);
  }
}
