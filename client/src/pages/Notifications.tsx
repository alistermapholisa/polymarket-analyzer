import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  ArrowLeft,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";

export default function NotificationsPage() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifications, isLoading, refetch } =
    trpc.notifications.list.useQuery({
      limit: 100,
      unreadOnly: filter === "unread",
    });

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => refetch(),
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetch(),
  });

  const handleMarkAsRead = (notificationId: number) => {
    markReadMutation.mutate({ notificationId });
  };

  const handleMarkAllAsRead = () => {
    markAllReadMutation.mutate();
  };

  const getSeverityIcon = (
    severity: "INFO" | "WARNING" | "ALERT" | null
  ) => {
    switch (severity) {
      case "INFO":
        return <Info className="w-5 h-5 text-blue-600" />;
      case "WARNING":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "ALERT":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Info className="w-5 h-5 text-slate-600" />;
    }
  };

  const getSeverityBgColor = (
    severity: "INFO" | "WARNING" | "ALERT" | null
  ) => {
    switch (severity) {
      case "INFO":
        return "bg-blue-50 border-blue-200";
      case "WARNING":
        return "bg-yellow-50 border-yellow-200";
      case "ALERT":
        return "bg-red-50 border-red-200";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  const getTypeLabel = (
    type: "THRESHOLD_CROSSED" | "MOVEMENT_DETECTED" | "PREDICTION_RESOLVED" | "ACCURACY_UPDATE"
  ) => {
    switch (type) {
      case "THRESHOLD_CROSSED":
        return "Threshold Alert";
      case "MOVEMENT_DETECTED":
        return "Market Movement";
      case "PREDICTION_RESOLVED":
        return "Prediction Resolved";
      case "ACCURACY_UPDATE":
        return "Accuracy Update";
      default:
        return "Notification";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;
  const displayedNotifications = notifications || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/markets")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                Notifications
              </h1>
              <p className="text-slate-600">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            </div>

            {unreadCount > 0 && (
              <Button
                onClick={handleMarkAllAsRead}
                disabled={markAllReadMutation.isPending}
                className="gap-2"
              >
                <Check className="w-4 h-4" />
                Mark All as Read
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")} className="mb-8">
          <TabsList>
            <TabsTrigger value="all">All ({displayedNotifications.length})</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Notifications List */}
        <div className="space-y-4">
          {displayedNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    All caught up!
                  </h3>
                  <p className="text-slate-600">
                    {filter === "unread"
                      ? "No unread notifications"
                      : "No notifications yet"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            displayedNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`border-l-4 transition-colors ${
                  !notification.isRead
                    ? getSeverityBgColor(notification.severity)
                    : "bg-white"
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getSeverityIcon(notification.severity)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900">
                              {notification.title}
                            </h3>
                            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">
                              {getTypeLabel(notification.type)}
                            </span>
                          </div>
                          <p className="text-slate-600 text-sm">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-500 mt-2">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex gap-2">
                          {!notification.isRead && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                              disabled={markReadMutation.isPending}
                              className="gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Mark Read
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      {notification.metadata && (
                        <div className="mt-3 p-3 bg-slate-100 rounded text-xs text-slate-700 font-mono">
                          {JSON.stringify(notification.metadata, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Empty State */}
        {displayedNotifications.length === 0 && filter === "all" && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No notifications
                </h3>
                <p className="text-slate-600">
                  Notifications will appear here when markets move or predictions are updated
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
