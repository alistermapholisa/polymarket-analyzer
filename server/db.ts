import { eq, desc, and, isNull, gt, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  markets,
  predictions,
  marketSnapshots,
  notifications,
  accuracyMetrics,
  watchlist,
  apiLogs,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Market queries
 */

export async function getActiveMarkets(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(markets)
    .where(eq(markets.active, true))
    .limit(limit)
    .offset(offset);
}

export async function getMarketById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(markets).where(eq(markets.id, id));
  return result.length > 0 ? result[0] : null;
}

export async function getMarketByPolymarketId(polymarketId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(markets)
    .where(eq(markets.polymarketId, polymarketId));
  return result.length > 0 ? result[0] : null;
}

export async function upsertMarket(market: typeof markets.$inferInsert) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getMarketByPolymarketId(market.polymarketId);
  if (existing) {
    await db
      .update(markets)
      .set({ ...market, updatedAt: new Date() })
      .where(eq(markets.id, existing.id));
    return existing.id;
  } else {
    const result = await db.insert(markets).values(market);
    return (result as any).insertId;
  }
}

/**
 * Prediction queries
 */

export async function getPredictionsByMarketId(
  marketId: number,
  limit: number = 50
) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(predictions)
    .where(eq(predictions.marketId, marketId))
    .orderBy(desc(predictions.createdAt))
    .limit(limit);
}

export async function getLatestPredictionByMarketId(marketId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(predictions)
    .where(eq(predictions.marketId, marketId))
    .orderBy(desc(predictions.createdAt))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createPrediction(
  prediction: typeof predictions.$inferInsert
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(predictions).values(prediction);
  return (result as any).insertId;
}

export async function updatePredictionOutcome(
  predictionId: number,
  actualOutcome: string,
  isAccurate: boolean
) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(predictions)
    .set({
      actualOutcome,
      isAccurate,
      marketResolved: true,
      updatedAt: new Date(),
    })
    .where(eq(predictions.id, predictionId));

  return true;
}

/**
 * Market snapshot queries
 */

export async function getLatestMarketSnapshot(marketId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(marketSnapshots)
    .where(eq(marketSnapshots.marketId, marketId))
    .orderBy(desc(marketSnapshots.timestamp))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getMarketSnapshotsSince(
  marketId: number,
  sinceTimestamp: Date,
  limit: number = 100
) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(marketSnapshots)
    .where(
      and(
        eq(marketSnapshots.marketId, marketId),
        gt(marketSnapshots.timestamp, sinceTimestamp)
      )
    )
    .orderBy(desc(marketSnapshots.timestamp))
    .limit(limit);
}

export async function createMarketSnapshot(
  snapshot: typeof marketSnapshots.$inferInsert
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(marketSnapshots).values(snapshot);
  return (result as any).insertId;
}

/**
 * Notification queries
 */

export async function getUserNotifications(
  userId: number,
  limit: number = 50,
  unreadOnly: boolean = false
) {
  const db = await getDb();
  if (!db) return [];

  const whereConditions = unreadOnly
    ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    : eq(notifications.userId, userId);

  return db
    .select()
    .from(notifications)
    .where(whereConditions)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function createNotification(
  notification: typeof notifications.$inferInsert
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(notifications).values(notification);
  return (result as any).insertId;
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId));

  return true;
}

export async function markAllNotificationsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.userId, userId));

  return true;
}

/**
 * Accuracy metrics queries
 */

export async function getAccuracyMetrics(
  period: "DAILY" | "WEEKLY" | "MONTHLY",
  limit: number = 30
) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(accuracyMetrics)
    .where(eq(accuracyMetrics.period, period))
    .orderBy(desc(accuracyMetrics.periodDate))
    .limit(limit);
}

export async function getLatestAccuracyMetrics(
  period: "DAILY" | "WEEKLY" | "MONTHLY"
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(accuracyMetrics)
    .where(eq(accuracyMetrics.period, period))
    .orderBy(desc(accuracyMetrics.periodDate))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function upsertAccuracyMetrics(
  metric: typeof accuracyMetrics.$inferInsert
) {
  const db = await getDb();
  if (!db) return null;

  const existing = await db
    .select()
    .from(accuracyMetrics)
    .where(
      and(
        eq(accuracyMetrics.period, metric.period),
        eq(accuracyMetrics.periodDate, metric.periodDate!)
      )
    );

  if (existing.length > 0) {
    await db
      .update(accuracyMetrics)
      .set({ ...metric, updatedAt: new Date() })
      .where(eq(accuracyMetrics.id, existing[0].id));
    return existing[0].id;
  } else {
    const result = await db.insert(accuracyMetrics).values(metric);
    return (result as any).insertId;
  }
}

/**
 * Watchlist queries
 */

export async function getUserWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const watchlistItems = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId));

  const marketIds = watchlistItems.map((item) => item.marketId);
  if (marketIds.length === 0) return [];

  return db.select().from(markets).where(eq(markets.id, marketIds[0])); // TODO: Fix IN clause
}

export async function addToWatchlist(userId: number, marketId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .insert(watchlist)
    .values({ userId, marketId });
  return (result as any).insertId;
}

export async function removeFromWatchlist(userId: number, marketId: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(watchlist)
    .where(
      and(
        eq(watchlist.userId, userId),
        eq(watchlist.marketId, marketId)
      )
    );

  return true;
}

/**
 * API logging
 */

export async function logApiCall(
  service: string,
  endpoint: string,
  method: string,
  statusCode?: number,
  responseTime?: number,
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(apiLogs).values({
      service,
      endpoint,
      method,
      statusCode,
      responseTime,
      errorMessage,
    });
  } catch (error) {
    console.error("[Database] Failed to log API call:", error);
  }
}
