import axios, { AxiosInstance } from "axios";
import { logApiCall } from "./db";

interface PolymarketEvent {
  id: string;
  title: string;
  description: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

interface PolymarketMarket {
  id: string;
  eventId: string;
  conditionId: string;
  question: string;
  outcomes: string[];
  outcomePrices: number[];
  volume24h: number;
  volume: number;
  enableOrderBook: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrderbookData {
  asset_id: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  timestamp: number;
}

class PolymarketClient {
  private gammaApi: AxiosInstance;
  private clobApi: AxiosInstance;
  private rtdsWs: WebSocket | null = null;
  private marketChannelWs: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.gammaApi = axios.create({
      baseURL: "https://gamma-api.polymarket.com",
      timeout: 10000,
    });

    this.clobApi = axios.create({
      baseURL: "https://clob.polymarket.com",
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.gammaApi.interceptors.response.use(
      (response) => {
        logApiCall(
          "polymarket",
          response.config.url || "",
          response.config.method || "GET",
          response.status,
          0
        );
        return response;
      },
      (error) => {
        logApiCall(
          "polymarket",
          error.config?.url || "",
          error.config?.method || "GET",
          error.response?.status,
          0,
          error.message
        );
        throw error;
      }
    );

    this.clobApi.interceptors.response.use(
      (response) => {
        logApiCall(
          "polymarket",
          response.config.url || "",
          response.config.method || "GET",
          response.status,
          0
        );
        return response;
      },
      (error) => {
        logApiCall(
          "polymarket",
          error.config?.url || "",
          error.config?.method || "GET",
          error.response?.status,
          0,
          error.message
        );
        throw error;
      }
    );
  }

  /**
   * Fetch active events from Polymarket
   */
  async getEvents(limit: number = 100, offset: number = 0): Promise<PolymarketEvent[]> {
    try {
      const response = await this.gammaApi.get("/events", {
        params: { limit, offset },
      });
      return response.data;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch events:", error);
      throw error;
    }
  }

  /**
   * Fetch markets for a specific event
   */
  async getMarketsByEvent(eventId: string): Promise<PolymarketMarket[]> {
    try {
      const response = await this.gammaApi.get("/markets", {
        params: { eventId },
      });
      return response.data;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch markets:", error);
      throw error;
    }
  }

  /**
   * Fetch all active markets
   */
  async getActiveMarkets(limit: number = 100, offset: number = 0): Promise<PolymarketMarket[]> {
    try {
      const response = await this.gammaApi.get("/markets", {
        params: { limit, offset, active: true },
      });
      return response.data;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch active markets:", error);
      throw error;
    }
  }

  /**
   * Fetch orderbook for a specific market
   */
  async getOrderbook(conditionId: string): Promise<OrderbookData> {
    try {
      const response = await this.clobApi.get(`/orderbooks/${conditionId}`);
      return response.data;
    } catch (error) {
      console.error("[Polymarket] Failed to fetch orderbook:", error);
      throw error;
    }
  }

  /**
   * Connect to WebSocket for real-time market updates
   */
  connectToMarketChannel(
    assetIds: string[],
    onMessage: (data: any) => void,
    onError: (error: Error) => void
  ): void {
    try {
      this.marketChannelWs = new WebSocket(
        "wss://es-subscriptions-clob.polymarket.com/ws/market"
      );

      this.marketChannelWs.onopen = () => {
        console.log("[Polymarket] WebSocket connected to market channel");
        this.reconnectAttempts = 0;

        // Subscribe to assets
        const subscriptionMessage = {
          assets_ids: assetIds,
          type: "market",
          custom_feature_enabled: true,
        };
        this.marketChannelWs?.send(JSON.stringify(subscriptionMessage));

        // Start heartbeat
        this.startHeartbeat();
      };

      this.marketChannelWs.onmessage = (event) => {
        try {
          if (event.data === "PONG") {
            // Heartbeat response
            return;
          }
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error("[Polymarket] Failed to parse WebSocket message:", error);
        }
      };

      this.marketChannelWs.onerror = (event) => {
        const error = new Error("WebSocket error");
        console.error("[Polymarket] WebSocket error:", error);
        onError(error);
      };

      this.marketChannelWs.onclose = () => {
        console.log("[Polymarket] WebSocket disconnected from market channel");
        this.attemptReconnect(assetIds, onMessage, onError);
      };
    } catch (error) {
      console.error("[Polymarket] Failed to connect to WebSocket:", error);
      onError(error as Error);
    }
  }

  /**
   * Subscribe to additional assets on existing WebSocket
   */
  subscribeToAssets(assetIds: string[]): void {
    if (!this.marketChannelWs || this.marketChannelWs.readyState !== WebSocket.OPEN) {
      console.warn("[Polymarket] WebSocket not connected, cannot subscribe");
      return;
    }

    const message = {
      assets_ids: assetIds,
      operation: "subscribe",
      custom_feature_enabled: true,
    };
    this.marketChannelWs.send(JSON.stringify(message));
  }

  /**
   * Unsubscribe from assets on existing WebSocket
   */
  unsubscribeFromAssets(assetIds: string[]): void {
    if (!this.marketChannelWs || this.marketChannelWs.readyState !== WebSocket.OPEN) {
      console.warn("[Polymarket] WebSocket not connected, cannot unsubscribe");
      return;
    }

    const message = {
      assets_ids: assetIds,
      operation: "unsubscribe",
    };
    this.marketChannelWs.send(JSON.stringify(message));
  }

  /**
   * Send heartbeat to keep WebSocket alive
   */
  private startHeartbeat(): void {
    const heartbeatInterval = setInterval(() => {
      if (this.marketChannelWs?.readyState === WebSocket.OPEN) {
        this.marketChannelWs.send("PING");
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 10000); // Send PING every 10 seconds
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(
    assetIds: string[],
    onMessage: (data: any) => void,
    onError: (error: Error) => void
  ): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[Polymarket] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(
      `[Polymarket] Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.connectToMarketChannel(assetIds, onMessage, onError);
    }, delay);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.marketChannelWs) {
      this.marketChannelWs.close();
      this.marketChannelWs = null;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return (
      this.marketChannelWs !== null &&
      this.marketChannelWs.readyState === WebSocket.OPEN
    );
  }
}

export const polymarketClient = new PolymarketClient();

export type { PolymarketEvent, PolymarketMarket, OrderbookData };
