import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { NotificationContainer } from "@/components/NotificationContainer";
import { NotificationBell } from "@/components/NotificationBell";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading) {
      setLocation("/markets");
    }
  }, [loading, setLocation]);

  return (
    <>
      <NotificationContainer />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="absolute top-4 right-4">
          <NotificationBell />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Polymarket Analyzer
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Real-time market analysis and AI-powered predictions
          </p>
          <Button size="lg" disabled>
            Loading...
          </Button>
        </div>
      </div>
    </>
  );
}
