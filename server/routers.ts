import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getActiveMarkets,
  getMarketById,
  getPredictionsByMarketId,
  getLatestPredictionByMarketId,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getAccuracyMetrics,
  getLatestAccuracyMetrics,
  getUserWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  logApiCall,
} from "./db";
import { polymarketClient } from "./polymarket";
import { predictionEngine } from "./predictor";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  /**
   * Markets procedures
   */
  markets: router({
    /**
     * Get list of active markets with latest predictions
     */
    list: publicProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
      )
      .query(async ({ input }) => {
        try {
          const markets = await getActiveMarkets(input.limit, input.offset);

          // Fetch latest predictions for each market
          const marketsWithPredictions = await Promise.all(
            markets.map(async (market) => {
              const latestPrediction = await getLatestPredictionByMarketId(
                market.id
              );
              return {
                ...market,
                latestPrediction,
              };
            })
          );

          return marketsWithPredictions;
        } catch (error) {
          console.error("[tRPC] Failed to fetch markets:", error);
          throw error;
        }
      }),

    /**
     * Get detailed view of a single market
     */
    detail: publicProcedure
      .input(z.object({ marketId: z.number() }))
      .query(async ({ input }) => {
        try {
          const market = await getMarketById(input.marketId);
          if (!market) {
            throw new Error("Market not found");
          }

          const predictions = await getPredictionsByMarketId(input.marketId, 20);
          const latestPrediction = await getLatestPredictionByMarketId(
            input.marketId
          );

          return {
            market,
            predictions,
            latestPrediction,
          };
        } catch (error) {
          console.error("[tRPC] Failed to fetch market detail:", error);
          throw error;
        }
      }),

    /**
     * Sync markets from Polymarket API
     */
    sync: publicProcedure.mutation(async () => {
      try {
        const markets = await polymarketClient.getActiveMarkets(100, 0);
        await logApiCall("polymarket", "/markets", "GET", 200, 0);

        return {
          success: true,
          count: markets.length,
          markets,
        };
      } catch (error) {
        console.error("[tRPC] Failed to sync markets:", error);
        await logApiCall(
          "polymarket",
          "/markets",
          "GET",
          500,
          0,
          error instanceof Error ? error.message : "Unknown error"
        );
        throw error;
      }
    }),
  }),

  /**
   * Predictions procedures
   */
  predictions: router({
    /**
     * Get prediction history for a market
     */
    history: publicProcedure
      .input(
        z.object({
          marketId: z.number(),
          limit: z.number().min(1).max(100).default(50),
        })
      )
      .query(async ({ input }) => {
        try {
          return await getPredictionsByMarketId(input.marketId, input.limit);
        } catch (error) {
          console.error("[tRPC] Failed to fetch prediction history:", error);
          throw error;
        }
      }),

    /**
     * Generate prediction for a market
     */
    generate: publicProcedure
      .input(
        z.object({
          marketId: z.number(),
          polymarketId: z.string(),
          marketName: z.string(),
          marketDescription: z.string(),
          outcomes: z.array(z.string()),
          currentPrices: z.array(z.number()),
          volume24h: z.number(),
          comments: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const prediction = await predictionEngine.generatePrediction({
            marketId: input.marketId,
            polymarketId: input.polymarketId,
            marketName: input.marketName,
            marketDescription: input.marketDescription,
            outcomes: input.outcomes,
            currentPrices: input.currentPrices,
            volume24h: input.volume24h,
            comments: input.comments,
          });

          return prediction;
        } catch (error) {
          console.error("[tRPC] Failed to generate prediction:", error);
          throw error;
        }
      }),
  }),

  /**
   * Notifications procedures
   */
  notifications: router({
    /**
     * Get user notifications
     */
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(50),
          unreadOnly: z.boolean().default(false),
        })
      )
      .query(async ({ ctx, input }) => {
        try {
          return await getUserNotifications(
            ctx.user.id,
            input.limit,
            input.unreadOnly
          );
        } catch (error) {
          console.error("[tRPC] Failed to fetch notifications:", error);
          throw error;
        }
      }),

    /**
     * Mark notification as read
     */
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await markNotificationAsRead(input.notificationId);
          return { success: true };
        } catch (error) {
          console.error("[tRPC] Failed to mark notification as read:", error);
          throw error;
        }
      }),

    /**
     * Mark all notifications as read
     */
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        await markAllNotificationsAsRead(ctx.user.id);
        return { success: true };
      } catch (error) {
        console.error("[tRPC] Failed to mark all notifications as read:", error);
        throw error;
      }
    }),
  }),

  /**
   * Metrics procedures
   */
  metrics: router({
    /**
     * Get accuracy metrics for a period
     */
    accuracy: publicProcedure
      .input(
        z.object({
          period: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("DAILY"),
          limit: z.number().min(1).max(100).default(30),
        })
      )
      .query(async ({ input }) => {
        try {
          return await getAccuracyMetrics(input.period, input.limit);
        } catch (error) {
          console.error("[tRPC] Failed to fetch accuracy metrics:", error);
          throw error;
        }
      }),

    /**
     * Get latest accuracy metrics
     */
    latestAccuracy: publicProcedure
      .input(
        z.object({
          period: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("DAILY"),
        })
      )
      .query(async ({ input }) => {
        try {
          return await getLatestAccuracyMetrics(input.period);
        } catch (error) {
          console.error("[tRPC] Failed to fetch latest accuracy metrics:", error);
          throw error;
        }
      }),
  }),

  /**
   * Watchlist procedures
   */
  watchlist: router({
    /**
     * Get user watchlist
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getUserWatchlist(ctx.user.id);
      } catch (error) {
        console.error("[tRPC] Failed to fetch watchlist:", error);
        throw error;
      }
    }),

    /**
     * Add market to watchlist
     */
    add: protectedProcedure
      .input(z.object({ marketId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await addToWatchlist(ctx.user.id, input.marketId);
          return { success: true };
        } catch (error) {
          console.error("[tRPC] Failed to add to watchlist:", error);
          throw error;
        }
      }),

    /**
     * Remove market from watchlist
     */
    remove: protectedProcedure
      .input(z.object({ marketId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await removeFromWatchlist(ctx.user.id, input.marketId);
          return { success: true };
        } catch (error) {
          console.error("[tRPC] Failed to remove from watchlist:", error);
          throw error;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
