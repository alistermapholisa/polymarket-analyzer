import { useEffect } from "react";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

export interface NotificationToastProps {
  id: string;
  title: string;
  message: string;
  severity?: "INFO" | "WARNING" | "ALERT" | "SUCCESS";
  duration?: number;
  onClose: (id: string) => void;
}

/**
 * Toast notification component for displaying temporary alerts
 */
export function NotificationToast({
  id,
  title,
  message,
  severity = "INFO",
  duration = 5000,
  onClose,
}: NotificationToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const severityStyles = {
    INFO: "bg-blue-50 border-blue-200 text-blue-900",
    WARNING: "bg-yellow-50 border-yellow-200 text-yellow-900",
    ALERT: "bg-red-50 border-red-200 text-red-900",
    SUCCESS: "bg-green-50 border-green-200 text-green-900",
  };

  const iconStyles = {
    INFO: "text-blue-600",
    WARNING: "text-yellow-600",
    ALERT: "text-red-600",
    SUCCESS: "text-green-600",
  };

  const IconComponent = {
    INFO: Info,
    WARNING: AlertTriangle,
    ALERT: AlertCircle,
    SUCCESS: CheckCircle,
  }[severity];

  return (
    <div
      className={`border rounded-lg p-4 shadow-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${severityStyles[severity]}`}
    >
      <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[severity]}`} />
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-sm opacity-90 mt-1">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
