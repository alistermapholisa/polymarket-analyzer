import { MarketSnapshot } from "../drizzle/schema";

interface MarketAnalysis {
  momentum: number;
  volatility: number;
  trend: "bullish" | "bearish" | "neutral";
  priceChange24h: number;
  volumeChange24h: number;
  technicalSignal: number; // 0 to 1, where 1 is strong bullish
}

interface PricePoint {
  price: number;
  timestamp: number;
}

/**
 * Market Analyzer
 * Performs technical analysis on market data to generate signals for predictions
 */
class MarketAnalyzer {
  /**
   * Calculate momentum from recent price movements
   * Returns a value from -1 (strong bearish) to 1 (strong bullish)
   */
  calculateMomentum(snapshots: MarketSnapshot[]): number {
    if (snapshots.length < 2) return 0;

    // Sort by timestamp ascending
    const sorted = [...snapshots].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    const prices = sorted.map((s) => {
      const priceArray = s.prices as unknown as number[];
      return priceArray[0]; // Yes price
    });

    if (prices.length < 2) return 0;

    // Calculate rate of change
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const priceChange = (lastPrice - firstPrice) / firstPrice;

    // Calculate momentum using simple moving average
    const shortMA = this.calculateMA(prices, 3);
    const longMA = this.calculateMA(prices, 10);

    if (shortMA === null || longMA === null) return 0;

    const maMomentum = (shortMA - longMA) / longMA;

    // Combine signals
    return Math.max(-1, Math.min(1, (priceChange + maMomentum) / 2));
  }

  /**
   * Calculate volatility from price movements
   * Returns a value from 0 to 1, where 1 is high volatility
   */
  calculateVolatility(snapshots: MarketSnapshot[]): number {
    if (snapshots.length < 2) return 0;

    const sorted = [...snapshots].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    const prices = sorted.map((s) => {
      const priceArray = s.prices as unknown as number[];
      return priceArray[0]; // Yes price
    });

    if (prices.length < 2) return 0;

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    // Calculate standard deviation
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Normalize to 0-1 range (assuming 20% daily volatility is high)
    return Math.min(1, stdDev / 0.2);
  }

  /**
   * Detect trend direction from price movements
   */
  detectTrend(snapshots: MarketSnapshot[]): "bullish" | "bearish" | "neutral" {
    if (snapshots.length < 2) return "neutral";

    const momentum = this.calculateMomentum(snapshots);

    if (momentum > 0.2) return "bullish";
    if (momentum < -0.2) return "bearish";
    return "neutral";
  }

  /**
   * Calculate volume-weighted probability
   * Combines price with volume to estimate probability
   */
  calculateVolumeWeightedProbability(
    currentPrice: number,
    volume24h: number,
    historicalVolumes: number[]
  ): number {
    // Base probability from price
    const baseProbability = currentPrice;

    // Volume adjustment factor
    const avgVolume = historicalVolumes.length > 0
      ? historicalVolumes.reduce((a, b) => a + b, 0) / historicalVolumes.length
      : volume24h;

    const volumeFactor = Math.min(1, volume24h / (avgVolume * 1.5));

    // Combine: higher volume increases confidence in the price signal
    const weightedProbability = baseProbability + (volumeFactor * 0.1 * (baseProbability - 0.5));

    return Math.max(0, Math.min(1, weightedProbability));
  }

  /**
   * Detect significant price movements
   */
  detectSignificantMovement(
    snapshots: MarketSnapshot[],
    threshold: number = 0.05
  ): boolean {
    if (snapshots.length < 2) return false;

    const sorted = [...snapshots].sort((a, b) =>
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    const prices = sorted.map((s) => {
      const priceArray = s.prices as unknown as number[];
      return priceArray[0]; // Yes price
    });

    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const change = Math.abs((lastPrice - firstPrice) / firstPrice);

    return change > threshold;
  }

  /**
   * Calculate technical signal for prediction
   * Returns 0 to 1, where 1 is strong buy signal
   */
  calculateTechnicalSignal(snapshots: MarketSnapshot[]): number {
    if (snapshots.length === 0) return 0.5;

    const momentum = this.calculateMomentum(snapshots);
    const volatility = this.calculateVolatility(snapshots);
    const trend = this.detectTrend(snapshots);

    // Normalize momentum to 0-1 range
    const normalizedMomentum = (momentum + 1) / 2;

    // Volatility adjustment: reduce signal confidence in high volatility
    const volatilityAdjustment = 1 - volatility * 0.3;

    // Trend boost
    const trendBoost = trend === "bullish" ? 0.1 : trend === "bearish" ? -0.1 : 0;

    const signal = (normalizedMomentum * volatilityAdjustment) + trendBoost;

    return Math.max(0, Math.min(1, signal));
  }

  /**
   * Generate comprehensive market analysis
   */
  analyzeMarket(snapshots: MarketSnapshot[]): MarketAnalysis {
    const momentum = this.calculateMomentum(snapshots);
    const volatility = this.calculateVolatility(snapshots);
    const trend = this.detectTrend(snapshots);
    const technicalSignal = this.calculateTechnicalSignal(snapshots);

    // Calculate 24h changes
    let priceChange24h = 0;
    let volumeChange24h = 0;

    if (snapshots.length >= 2) {
      const sorted = [...snapshots].sort((a, b) =>
        a.timestamp.getTime() - b.timestamp.getTime()
      );

      const oldestSnapshot = sorted[0];
      const newestSnapshot = sorted[sorted.length - 1];

      const oldestPrice = (oldestSnapshot.prices as unknown as number[])[0];
      const newestPrice = (newestSnapshot.prices as unknown as number[])[0];

      priceChange24h = (newestPrice - oldestPrice) / oldestPrice;

      const oldestVolume = Number(oldestSnapshot.volume24h) || 0;
      const newestVolume = Number(newestSnapshot.volume24h) || 0;

      if (oldestVolume > 0) {
        volumeChange24h = (newestVolume - oldestVolume) / oldestVolume;
      }
    }

    return {
      momentum,
      volatility,
      trend,
      priceChange24h,
      volumeChange24h,
      technicalSignal,
    };
  }

  /**
   * Calculate simple moving average
   */
  private calculateMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;

    const recentPrices = prices.slice(-period);
    return recentPrices.reduce((a, b) => a + b, 0) / period;
  }
}

export const marketAnalyzer = new MarketAnalyzer();

export type { MarketAnalysis };
