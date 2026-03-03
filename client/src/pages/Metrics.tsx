import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";

export default function Metrics() {
  const [period, setPeriod] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");

  const { data: accuracyData, isLoading } = trpc.metrics.accuracy.useQuery({
    period,
    limit: 30,
  });

  const { data: latestMetrics } = trpc.metrics.latestAccuracy.useQuery({
    period,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  // Prepare chart data
  const chartData = (accuracyData || []).map((metric) => ({
    date: new Date(metric.period).toLocaleDateString(),
    accuracy: Number(metric.accuracy) * 100,
    totalPredictions: metric.totalPredictions,
    accuratePredictions: metric.accuratePredictions,
    avgConfidence: Number(metric.averageConfidence) * 100,
  }));

  // Calculate statistics
  const totalPredictions = accuracyData?.reduce(
    (sum, m) => sum + (m.totalPredictions || 0),
    0
  ) || 0;
  const totalAccurate = accuracyData?.reduce(
    (sum, m) => sum + (m.accuratePredictions || 0),
    0
  ) || 0;
  const overallAccuracy =
    totalPredictions > 0 ? (totalAccurate / totalPredictions) * 100 : 0;

  // Pie chart data
  const pieData = [
    { name: "Accurate", value: totalAccurate },
    { name: "Inaccurate", value: totalPredictions - totalAccurate },
  ];

  const COLORS = ["#10b981", "#ef4444"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Prediction Metrics
          </h1>
          <p className="text-slate-600">
            Track prediction accuracy and performance over time
          </p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Overall Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-slate-900">
                {overallAccuracy.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-600 mt-2">
                {totalAccurate} accurate out of {totalPredictions}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-slate-900">
                {totalPredictions}
              </p>
              <p className="text-xs text-slate-600 mt-2">
                {period === "DAILY"
                  ? "Last 30 days"
                  : period === "WEEKLY"
                    ? "Last 30 weeks"
                    : "Last 30 months"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Accurate Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-600">{totalAccurate}</p>
              <p className="text-xs text-slate-600 mt-2">
                {((totalAccurate / totalPredictions) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Avg Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-slate-900">
                {latestMetrics
                  ? (Number(latestMetrics.averageConfidence) * 100).toFixed(0)
                  : "N/A"}
                %
              </p>
              <p className="text-xs text-slate-600 mt-2">
                Current period average
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Period Selector */}
        <div className="mb-8">
          <div className="flex gap-2">
            {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  period === p
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p === "DAILY" ? "Daily" : p === "WEEKLY" ? "Weekly" : "Monthly"}
              </button>
            ))}
          </div>
        </div>

        {/* Charts */}
        <Tabs defaultValue="accuracy" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="accuracy">Accuracy Trend</TabsTrigger>
            <TabsTrigger value="predictions">Predictions</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
          </TabsList>

          {/* Accuracy Trend */}
          <TabsContent value="accuracy">
            <Card>
              <CardHeader>
                <CardTitle>Accuracy Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value: any) => `${Number(value).toFixed(1)}%`} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#3b82f6"
                        name="Accuracy"
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgConfidence"
                        stroke="#10b981"
                        name="Avg Confidence"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Predictions Count */}
          <TabsContent value="predictions">
            <Card>
              <CardHeader>
                <CardTitle>Predictions Per Period</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalPredictions" fill="#3b82f6" name="Total" />
                      <Bar
                        dataKey="accuratePredictions"
                        fill="#10b981"
                        name="Accurate"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Distribution */}
          <TabsContent value="distribution">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Accuracy Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData[0].value + pieData[1].value > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) =>
                            `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-slate-500 text-center py-8">No data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Summary Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-4 border-b">
                      <span className="text-slate-600">Total Predictions</span>
                      <span className="font-bold text-lg">{totalPredictions}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b">
                      <span className="text-slate-600">Accurate</span>
                      <span className="font-bold text-lg text-green-600">
                        {totalAccurate}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b">
                      <span className="text-slate-600">Inaccurate</span>
                      <span className="font-bold text-lg text-red-600">
                        {totalPredictions - totalAccurate}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Success Rate</span>
                      <span className="font-bold text-lg text-blue-600">
                        {overallAccuracy.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Detailed Table */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Period Details</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                      <th className="px-4 py-3 text-right font-semibold">Accurate</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Inaccurate
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">Accuracy</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Avg Confidence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {chartData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">{row.date}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {row.totalPredictions || 0}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600 font-semibold">
                          {row.accuratePredictions || 0}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-semibold">
                          {(row.totalPredictions || 0) - (row.accuratePredictions || 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {row.accuracy.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.avgConfidence.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
