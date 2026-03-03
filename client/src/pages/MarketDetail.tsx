import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { Loader2, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function MarketDetail() {
  const [, params] = useRoute("/market/:id");
  const [, setLocation] = useLocation();
  const marketId = params?.id ? parseInt(params.id) : 0;
  const { user } = useAuth();

  const { data: marketData, isLoading: marketLoading } = trpc.markets.detail.useQuery(
    { marketId },
    { enabled: marketId > 0 }
  );

  const { data: predictionHistory, isLoading: historyLoading } =
    trpc.predictions.history.useQuery(
      { marketId, limit: 50 },
      { enabled: marketId > 0 }
    );

  const addToWatchlistMutation = trpc.watchlist.add.useMutation();
  const removeFromWatchlistMutation = trpc.watchlist.remove.useMutation();

  if (marketLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (!marketData?.market) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-900 font-semibold">Market not found</h2>
          <Button
            variant="outline"
            onClick={() => setLocation("/markets")}
            className="mt-4"
          >
            Back to Markets
          </Button>
        </div>
      </div>
    );
  }

  const market = marketData.market;
  const latestPrediction = marketData.latestPrediction;

  // Prepare chart data from predictions
  const chartData = (predictionHistory || [])
    .slice()
    .reverse()
    .map((pred, idx) => ({
      time: new Date(pred.createdAt).toLocaleTimeString(),
      probability: Number(pred.predictedProbability) * 100,
      confidence: Number(pred.confidence) * 100,
      technicalSignal: (pred.signals?.technicalSignal as number) * 100 || 0,
      sentimentScore: (pred.signals?.sentimentScore as number) * 100 || 0,
    }));

  // Calculate statistics
  const predictions = predictionHistory || [];
  const accuratePredictions = predictions.filter((p) => p.isAccurate).length;
  const accuracy =
    predictions.length > 0 ? (accuratePredictions / predictions.length) * 100 : 0;
  const avgConfidence =
    predictions.length > 0
      ? (predictions.reduce((sum, p) => sum + Number(p.confidence), 0) /
          predictions.length) *
        100
      : 0;

  const handleAddToWatchlist = () => {
    addToWatchlistMutation.mutate({ marketId });
  };

  const handleRemoveFromWatchlist = () => {
    removeFromWatchlistMutation.mutate({ marketId });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/markets")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Markets
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-2">{market.eventName}</p>
              <h1 className="text-4xl font-bold text-slate-900 mb-4">
                {market.marketName}
              </h1>
              <div className="flex gap-4">
                <div>
                  <p className="text-sm text-slate-600">Market ID</p>
                  <p className="font-mono text-sm">{market.polymarketId}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Status</p>
                  <p className="font-semibold">
                    {market.active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
            </div>

            {user && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleAddToWatchlist}
                  disabled={addToWatchlistMutation.isPending}
                >
                  + Watchlist
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Current Prediction Card */}
        {latestPrediction && (
          <Card className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">Latest Prediction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-blue-700 mb-2">Predicted Outcome</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {latestPrediction.predictedOutcome}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-700 mb-2">Probability</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {(Number(latestPrediction.predictedProbability) * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-700 mb-2">Confidence</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {(Number(latestPrediction.confidence) * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-blue-700 mb-2">Generated</p>
                  <p className="text-sm font-mono text-blue-900">
                    {new Date(latestPrediction.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts and History Tabs */}
        <Tabs defaultValue="charts" className="mb-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          {/* Charts Tab */}
          <TabsContent value="charts" className="space-y-8">
            {/* Probability Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Prediction Probability Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="probability"
                        stroke="#3b82f6"
                        name="Probability"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="confidence"
                        stroke="#10b981"
                        name="Confidence"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Signals Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Analysis Signals</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis domain={[-100, 100]} />
                      <Tooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
                      <Legend />
                      <Bar dataKey="technicalSignal" fill="#f59e0b" name="Technical" />
                      <Line
                        type="monotone"
                        dataKey="sentimentScore"
                        stroke="#8b5cf6"
                        name="Sentiment"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Prediction History</CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin w-6 h-6" />
                  </div>
                ) : predictions.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    No predictions yet
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">
                            Time
                          </th>
                          <th className="px-4 py-3 text-left font-semibold">
                            Outcome
                          </th>
                          <th className="px-4 py-3 text-right font-semibold">
                            Probability
                          </th>
                          <th className="px-4 py-3 text-right font-semibold">
                            Confidence
                          </th>
                          <th className="px-4 py-3 text-center font-semibold">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {predictions.map((pred) => (
                          <tr key={pred.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600">
                              {new Date(pred.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {pred.predictedOutcome}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(Number(pred.predictedProbability) * 100).toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(Number(pred.confidence) * 100).toFixed(0)}%
                            </td>
                            <td className="px-4 py-3 text-center">
                              {pred.marketResolved ? (
                                pred.isAccurate ? (
                                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                                    <TrendingUp className="w-3 h-3" />
                                    Accurate
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                                    <TrendingDown className="w-3 h-3" />
                                    Inaccurate
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-500 text-xs">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Total Predictions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">
                    {predictions.length}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Accuracy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">
                    {accuracy.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-600 mt-2">
                    {accuratePredictions} accurate out of {predictions.length}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Avg Confidence</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900">
                    {avgConfidence.toFixed(0)}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Outcomes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {market.outcomes.map((outcome) => (
                      <div key={outcome} className="text-sm">
                        <p className="text-slate-600">{outcome}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Metrics */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Market Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Event Name</p>
                    <p className="font-semibold text-slate-900">
                      {market.eventName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Market Name</p>
                    <p className="font-semibold text-slate-900">
                      {market.marketName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Condition ID</p>
                    <p className="font-mono text-xs text-slate-900 break-all">
                      {market.conditionId}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Order Book</p>
                    <p className="font-semibold text-slate-900">
                      {market.enableOrderBook ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Created</p>
                    <p className="font-mono text-xs text-slate-900">
                      {new Date(market.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Last Updated</p>
                    <p className="font-mono text-xs text-slate-900">
                      {new Date(market.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
