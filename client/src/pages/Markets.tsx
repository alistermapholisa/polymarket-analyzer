import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { NotificationContainer } from "@/components/NotificationContainer";
import { NotificationBell } from "@/components/NotificationBell";

export default function Markets() {
  const [limit] = useState(50);
  const [offset] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: marketsData, isLoading, error } = trpc.markets.list.useQuery({
    limit,
    offset,
  });

  const filteredMarkets = marketsData?.filter((market) =>
    market.marketName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    market.eventName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-900 font-semibold">Error loading markets</h2>
          <p className="text-red-700">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <NotificationContainer />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                Polymarket Analyzer
              </h1>
              <p className="text-slate-600">
                Real-time market analysis and AI-powered predictions
              </p>
            </div>
            <NotificationBell />
          </div>

        {/* Navigation and Search */}
        <div className="mb-8 space-y-4">
          <div className="flex gap-2">
            <Link href="/markets">
              <a className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                Markets
              </a>
            </Link>
            <Link href="/metrics">
              <a className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg font-semibold hover:bg-slate-300 transition-colors">
                Metrics
              </a>
            </Link>
          </div>
          <Input
            placeholder="Search markets by name or event..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Markets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-slate-500">No markets found</p>
            </div>
          ) : (
            filteredMarkets.map((market) => (
              <Link
                key={market.id}
                href={`/market/${market.id}`}
              >
                <a>
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <div className="space-y-2">
                        <p className="text-sm text-slate-500">{market.eventName}</p>
                        <CardTitle className="text-lg line-clamp-2">
                          {market.marketName}
                        </CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Prices */}
                        <div className="grid grid-cols-2 gap-4">
                          {market.outcomes.map((outcome, idx) => {
                            const price = market.latestPrediction?.signals
                              ? (Object.values(market.latestPrediction.signals)[0] as number)
                              : 0;
                            return (
                              <div key={idx} className="text-center">
                                <p className="text-sm text-slate-600">{outcome}</p>
                                <p className="text-2xl font-bold text-slate-900">
                                  {(price * 100).toFixed(1)}%
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Prediction */}
                        {market.latestPrediction && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-blue-900">
                                Prediction
                              </span>
                              <span className="text-xs bg-blue-200 text-blue-900 px-2 py-1 rounded">
                                {(Number(market.latestPrediction.confidence) * 100).toFixed(0)}% confidence
                              </span>
                            </div>
                            <p className="text-sm text-blue-800">
                              {market.latestPrediction.predictedOutcome}
                            </p>
                          </div>
                        )}

                        {/* Volume */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">24h Volume</span>
                          <span className="font-semibold text-slate-900">
                            ${Number(market.latestPrediction?.signals?.volumeChange || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
    </>
  );
}
