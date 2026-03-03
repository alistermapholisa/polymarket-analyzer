import { MarketSnapshot } from "../drizzle/schema";
import { marketAnalyzer, MarketAnalysis } from "./analyzer";
import { sentimentAnalyzer, SentimentAnalysisResult } from "./sentiment";
import {
  getLatestMarketSnapshot,
  getMarketSnapshotsSince,
  createPrediction,
} from "./db";

interface PredictionInput {
  marketId: number;
  polymarketId: string;
  marketName: string;
  marketDescription: string;
  outcomes: string[];
  currentPrices: number[];
  volume24h: number;
  comments?: string[];
}

interface PredictionOutput {
  marketId: number;
  polymarketId: string;
  predictedOutcome: string;
  predictedProbability: number;
  confidence: number;
  signals: Record<string, number>;
  signalWeights: Record<string, number>;
  reasoning: string;
}

/**
 * Prediction Engine
 * Combines technical analysis and LLM sentiment analysis to generate predictions
 */
class PredictionEngine {
  private signalWeights = {
    technical: 0.4,
    sentiment: 0.6,
  };

  /**
   * Generate a prediction for a market
   */
  async generatePrediction(input: PredictionInput): Promise<PredictionOutput> {
    try {
      // Get historical snapshots for technical analysis
      const oneHourAgo = new Date(Date.now() - 3600000);
      const snapshots = await getMarketSnapshotsSince(input.marketId, oneHourAgo, 100);

      // Perform technical analysis
      const technicalAnalysis = marketAnalyzer.analyzeMarket(snapshots);
      const technicalSignal = technicalAnalysis.technicalSignal;

      // Perform sentiment analysis
      const sentimentAnalysis = await sentimentAnalyzer.analyzeMarketSentiment(
        input.marketName,
        input.marketDescription,
        input.comments
      );

      // Combine signals
      const combinedProbability =
        technicalSignal * this.signalWeights.technical +
        sentimentAnalysis.predictedProbability * this.signalWeights.sentiment;

      // Determine predicted outcome
      const predictedOutcome = combinedProbability > 0.5 ? input.outcomes[0] : input.outcomes[1];

      // Calculate confidence
      const confidence = this.calculateConfidence(
        technicalAnalysis,
        sentimentAnalysis,
        snapshots.length
      );

      // Prepare signals object
      const signals = {
        technicalSignal,
        sentimentScore: sentimentAnalysis.score,
        momentum: technicalAnalysis.momentum,
        volatility: technicalAnalysis.volatility,
        volumeChange: technicalAnalysis.volumeChange24h,
        priceChange: technicalAnalysis.priceChange24h,
      };

      // Generate reasoning
      const reasoning = this.generateReasoning(
        technicalAnalysis,
        sentimentAnalysis,
        input.outcomes
      );

      return {
        marketId: input.marketId,
        polymarketId: input.polymarketId,
        predictedOutcome,
        predictedProbability: combinedProbability,
        confidence,
        signals,
        signalWeights: this.signalWeights,
        reasoning,
      };
    } catch (error) {
      console.error("[Predictor] Failed to generate prediction:", error);
      throw error;
    }
  }

  /**
   * Calculate confidence score for prediction
   */
  private calculateConfidence(
    technicalAnalysis: MarketAnalysis,
    sentimentAnalysis: SentimentAnalysisResult,
    snapshotCount: number
  ): number {
    // Base confidence from sentiment analysis
    let confidence = sentimentAnalysis.confidence;

    // Boost confidence if technical and sentiment agree
    const technicalBullish = technicalAnalysis.technicalSignal > 0.5;
    const sentimentBullish = sentimentAnalysis.predictedProbability > 0.5;

    if (technicalBullish === sentimentBullish) {
      confidence += 0.1;
    }

    // Reduce confidence if volatility is high
    if (technicalAnalysis.volatility > 0.7) {
      confidence -= 0.15;
    }

    // Boost confidence if we have sufficient historical data
    if (snapshotCount > 50) {
      confidence += 0.05;
    }

    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate human-readable reasoning for prediction
   */
  private generateReasoning(
    technicalAnalysis: MarketAnalysis,
    sentimentAnalysis: SentimentAnalysisResult,
    outcomes: string[]
  ): string {
    const parts: string[] = [];

    // Technical analysis reasoning
    if (technicalAnalysis.trend === "bullish") {
      parts.push("Technical indicators show bullish momentum");
    } else if (technicalAnalysis.trend === "bearish") {
      parts.push("Technical indicators show bearish momentum");
    } else {
      parts.push("Technical indicators are neutral");
    }

    // Sentiment reasoning
    if (sentimentAnalysis.sentiment === "positive") {
      parts.push("Sentiment analysis indicates positive outlook");
    } else if (sentimentAnalysis.sentiment === "negative") {
      parts.push("Sentiment analysis indicates negative outlook");
    } else {
      parts.push("Sentiment analysis is neutral");
    }

    // Volatility warning
    if (technicalAnalysis.volatility > 0.7) {
      parts.push("High volatility detected - prediction confidence is lower");
    }

    // Price change
    const priceChangePercent = (technicalAnalysis.priceChange24h * 100).toFixed(2);
    parts.push(`24h price movement: ${priceChangePercent}%`);

    return parts.join(". ");
  }

  /**
   * Calculate prediction accuracy after market resolution
   */
  calculateAccuracy(
    predictedProbability: number,
    actualOutcome: boolean
  ): {
    isAccurate: boolean;
    error: number;
  } {
    const actualProbability = actualOutcome ? 1 : 0;
    const error = Math.abs(predictedProbability - actualProbability);
    const isAccurate = error < 0.3; // Consider prediction accurate if within 30%

    return {
      isAccurate,
      error,
    };
  }

  /**
   * Adjust prediction weights based on historical accuracy
   */
  adjustWeights(historicalAccuracy: number): void {
    // If historical accuracy is high, increase technical weight
    // If low, increase sentiment weight
    const technicalBoost = Math.max(0.3, Math.min(0.7, historicalAccuracy));
    const sentimentBoost = 1 - technicalBoost;

    this.signalWeights = {
      technical: technicalBoost,
      sentiment: sentimentBoost,
    };

    console.log(
      `[Predictor] Adjusted weights - Technical: ${technicalBoost.toFixed(2)}, Sentiment: ${sentimentBoost.toFixed(2)}`
    );
  }
}

export const predictionEngine = new PredictionEngine();

export type { PredictionInput, PredictionOutput };
