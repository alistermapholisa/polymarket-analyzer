import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { logApiCall } from "./db";

interface SentimentAnalysisResult {
  sentiment: "positive" | "negative" | "neutral";
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  reasoning: string;
  predictedProbability: number; // 0 to 1
}

/**
 * LLM Sentiment Analyzer
 * Uses Manus Forge API (OpenAI compatible) to analyze market sentiment
 */
class SentimentAnalyzer {
  private client: ReturnType<typeof createOpenAI>;
  private model = "gpt-4-turbo";
  private cache: Map<string, SentimentAnalysisResult> = new Map();
  private cacheExpiry = 3600000; // 1 hour

  constructor() {
    // Use Manus Forge API endpoint
    const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
    const apiUrl = process.env.BUILT_IN_FORGE_API_URL;

    if (!apiKey || !apiUrl) {
      console.warn("[Sentiment] Forge API credentials not configured");
    }

    this.client = createOpenAI({
      apiKey: apiKey || "",
      baseURL: apiUrl,
    });
  }

  /**
   * Analyze market sentiment from description and comments
   */
  async analyzeMarketSentiment(
    marketName: string,
    marketDescription: string,
    comments?: string[]
  ): Promise<SentimentAnalysisResult> {
    const cacheKey = this.generateCacheKey(marketName, marketDescription);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - (cached as any).timestamp < this.cacheExpiry) {
      return cached;
    }

    try {
      const prompt = this.buildAnalysisPrompt(
        marketName,
        marketDescription,
        comments
      );

      const startTime = Date.now();
      const result = await generateText({
        model: this.client(this.model),
        prompt,
        temperature: 0.3,
      });
      const responseTime = Date.now() - startTime;

      await logApiCall(
        "llm",
        "/sentiment-analysis",
        "POST",
        200,
        responseTime
      );

      const analysis = this.parseAnalysisResponse(result.text);

      // Cache result
      (analysis as any).timestamp = Date.now();
      this.cache.set(cacheKey, analysis);

      return analysis;
    } catch (error) {
      console.error("[Sentiment] Failed to analyze sentiment:", error);
      await logApiCall(
        "llm",
        "/sentiment-analysis",
        "POST",
        500,
        0,
        error instanceof Error ? error.message : "Unknown error"
      );

      // Return neutral analysis on error
      return {
        sentiment: "neutral",
        score: 0,
        confidence: 0,
        reasoning: "Analysis failed, returning neutral prediction",
        predictedProbability: 0.5,
      };
    }
  }

  /**
   * Analyze prediction accuracy and generate insights
   */
  async analyzePredictionAccuracy(
    marketName: string,
    prediction: number,
    actualOutcome: number,
    historicalAccuracy: number
  ): Promise<{
    insight: string;
    adjustmentFactor: number;
  }> {
    try {
      const prompt = `
Analyze the prediction accuracy for the market: "${marketName}"

Predicted Probability: ${(prediction * 100).toFixed(2)}%
Actual Outcome: ${(actualOutcome * 100).toFixed(2)}%
Historical Accuracy: ${(historicalAccuracy * 100).toFixed(2)}%

Provide a brief insight (1-2 sentences) about what went wrong or right with this prediction, and suggest an adjustment factor (0.8 to 1.2) to apply to future predictions for similar markets.

Format your response as JSON:
{
  "insight": "...",
  "adjustmentFactor": 1.0
}
`;

      const result = await generateText({
        model: this.client(this.model),
        prompt,
        temperature: 0.3,
      });

      const parsed = JSON.parse(result.text);
      return {
        insight: parsed.insight || "No insight available",
        adjustmentFactor: Math.max(0.8, Math.min(1.2, parsed.adjustmentFactor || 1.0)),
      };
    } catch (error) {
      console.error("[Sentiment] Failed to analyze accuracy:", error);
      return {
        insight: "Unable to generate insight",
        adjustmentFactor: 1.0,
      };
    }
  }

  /**
   * Build analysis prompt for LLM
   */
  private buildAnalysisPrompt(
    marketName: string,
    description: string,
    comments?: string[]
  ): string {
    const commentSection = comments && comments.length > 0
      ? `\n\nRecent Comments:\n${comments.slice(0, 5).join("\n")}`
      : "";

    return `
You are a prediction market analyst. Analyze the following market and provide a sentiment analysis.

Market: ${marketName}
Description: ${description}${commentSection}

Provide your analysis in the following JSON format:
{
  "sentiment": "positive" | "negative" | "neutral",
  "score": -1 to 1 (where -1 is very negative, 0 is neutral, 1 is very positive),
  "confidence": 0 to 1 (how confident you are in this analysis),
  "reasoning": "Brief explanation of your analysis",
  "predictedProbability": 0 to 1 (predicted probability of the positive outcome)
}

Focus on:
1. Market fundamentals and likelihood of the outcome
2. Sentiment expressed in comments
3. Historical context if available
4. Any red flags or strong indicators

Respond only with valid JSON, no additional text.
`;
  }

  /**
   * Parse LLM response into structured format
   */
  private parseAnalysisResponse(response: string): SentimentAnalysisResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        sentiment: parsed.sentiment || "neutral",
        score: Math.max(-1, Math.min(1, parsed.score || 0)),
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        reasoning: parsed.reasoning || "",
        predictedProbability: Math.max(0, Math.min(1, parsed.predictedProbability || 0.5)),
      };
    } catch (error) {
      console.error("[Sentiment] Failed to parse response:", error);
      return {
        sentiment: "neutral",
        score: 0,
        confidence: 0,
        reasoning: "Failed to parse analysis",
        predictedProbability: 0.5,
      };
    }
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(marketName: string, description: string): string {
    return `${marketName}:${description.substring(0, 100)}`;
  }

  /**
   * Clear old cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.cache.forEach((value, key) => {
      if (now - (value as any).timestamp > this.cacheExpiry) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer();

export type { SentimentAnalysisResult };
