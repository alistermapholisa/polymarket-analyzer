import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { markets, notifications } from "../drizzle/schema";
import { eq, gt } from "drizzle-orm";

export interface MarketMovement {
  marketId: number;
  priceChange: number;
  percentChange: number;
  previousPrice: number;
  currentPrice: number;
  volumeChange: number;
  timestamp: Date;
}

/**
 * Detects significant market movements and creates notifications
 * Thresholds:
 * - Price change > 5% triggers WARNING
 * - Price change > 10% triggers ALERT
 * - Volume spike > 50% triggers INFO
 */
export async function detectMarketMovements(
  movements: MarketMovement[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  for (const movement of movements) {
    const market = await db
      .select()
      .from(markets)
      .where(eq(markets.id, movement.marketId))
      .limit(1);

    if (market.length === 0) continue;

    const marketData = market[0];
    const percentChange = Math.abs(movement.percentChange);

    let severity: "INFO" | "WARNING" | "ALERT" = "INFO";
    let shouldNotify = false;
    let title = "";
    let message = "";

    // Determine notification severity based on price movement
    if (percentChange > 10) {
      severity = "ALERT";
      shouldNotify = true;
      title = `🚨 Major Market Movement: ${marketData.marketName}`;
      message = `Price changed by ${movement.percentChange.toFixed(2)}% (${movement.previousPrice.toFixed(4)} → ${movement.currentPrice.toFixed(4)})`;
    } else if (percentChange > 5) {
      severity = "WARNING";
      shouldNotify = true;
      title = `⚠️ Significant Market Movement: ${marketData.marketName}`;
      message = `Price changed by ${movement.percentChange.toFixed(2)}% (${movement.previousPrice.toFixed(4)} → ${movement.currentPrice.toFixed(4)})`;
    } else if (movement.volumeChange > 50) {
      severity = "INFO";
      shouldNotify = true;
      title = `📊 Volume Spike: ${marketData.marketName}`;
      message = `Trading volume increased by ${movement.volumeChange.toFixed(0)}%`;
    }

    // Create notification if threshold crossed
    if (shouldNotify) {
      try {
        await db.insert(notifications).values({
          userId: 0, // System notification
          type: "MOVEMENT_DETECTED",
          title,
          message,
          severity,
          marketId: movement.marketId,
          metadata: {
            priceChange: movement.percentChange,
            previousPrice: movement.previousPrice,
            currentPrice: movement.currentPrice,
            volumeChange: movement.volumeChange,
          },
        });

        // Notify owner of significant movements
        if (severity === "ALERT") {
          await notifyOwner({
            title: `Market Alert: ${marketData.marketName}`,
            content: `${message}\n\nMarket ID: ${marketData.polymarketId}`,
          });
        }
      } catch (error) {
        console.error(`[Movement Detector] Failed to create notification:`, error);
      }
    }
  }
}

/**
 * Detects when prediction accuracy crosses thresholds
 * Triggers notifications at 50%, 70%, 90% accuracy milestones
 */
export async function detectAccuracyThresholds(
  marketId: number,
  accuracy: number,
  totalPredictions: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  if (totalPredictions < 5) return; // Require minimum predictions

  let shouldNotify = false;
  let severity: "INFO" | "WARNING" | "ALERT" = "INFO";
  let title = "";
  let message = "";

  // Check accuracy milestones
  if (accuracy >= 0.9) {
    severity = "ALERT";
    shouldNotify = true;
    title = "🏆 Excellent Prediction Accuracy";
    message = `Market ID ${marketId} has reached 90%+ accuracy (${accuracy.toFixed(1)}%) across ${totalPredictions} predictions`;
  } else if (accuracy >= 0.7) {
    severity = "WARNING";
    shouldNotify = true;
    title = "✅ Strong Prediction Accuracy";
    message = `Market ID ${marketId} has reached 70%+ accuracy (${accuracy.toFixed(1)}%) across ${totalPredictions} predictions`;
  } else if (accuracy >= 0.5) {
    severity = "INFO";
    shouldNotify = true;
    title = "📈 Moderate Prediction Accuracy";
    message = `Market ID ${marketId} has reached 50%+ accuracy (${accuracy.toFixed(1)}%) across ${totalPredictions} predictions`;
  }

  if (shouldNotify) {
    try {
      await db.insert(notifications).values({
        userId: 0, // System notification
        type: "THRESHOLD_CROSSED",
        title,
        message,
        severity,
        marketId,
        metadata: {
          accuracy: accuracy.toFixed(2),
          totalPredictions,
          milestone: `${Math.round(accuracy * 100)}%`,
        },
      });

      // Notify owner of significant accuracy achievements
      if (severity === "ALERT" || severity === "WARNING") {
        await notifyOwner({
          title,
          content: message,
        });
      }
    } catch (error) {
      console.error(`[Accuracy Detector] Failed to create notification:`, error);
    }
  }
}

/**
 * Detects when predictions are resolved and creates accuracy update notifications
 */
export async function detectPredictionResolution(
  marketId: number,
  predictedOutcome: string,
  actualOutcome: string,
  isAccurate: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const severity = isAccurate ? "INFO" : "WARNING";
  const title = isAccurate
    ? "✅ Prediction Confirmed Accurate"
    : "❌ Prediction Was Inaccurate";
  const message = `Predicted: ${predictedOutcome} | Actual: ${actualOutcome}`;

  try {
    await db.insert(notifications).values({
      userId: 0, // System notification
      type: "PREDICTION_RESOLVED",
      title,
      message,
      severity,
      marketId,
      metadata: {
        predictedOutcome,
        actualOutcome,
        isAccurate,
      },
    });
  } catch (error) {
    console.error(`[Resolution Detector] Failed to create notification:`, error);
  }
}
