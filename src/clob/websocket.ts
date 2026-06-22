import WebSocket from 'ws';

export interface WsBookLevel {
  price: string;
  size: string;
}

export interface WsOrderBookUpdate {
  channel: string;
  market_id: string;
  bids: WsBookLevel[];
  asks: WsBookLevel[];
  timestamp: string;
}

export interface WsTradeUpdate {
  channel: string;
  market_id: string;
  price: string;
  size: string;
  side: 'buy' | 'sell';
  timestamp: string;
}

export type BookUpdateCallback = (data: WsOrderBookUpdate) => void;
export type TradeUpdateCallback = (data: WsTradeUpdate) => void;

export class ClobWebSocketClient {
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private autoReconnect = true;
  private subscriptions: Set<string> = new Set(); // format: "channel:marketId"

  private bookCallbacks: Map<string, Set<BookUpdateCallback>> = new Map(); // marketId -> callbacks
  private tradeCallbacks: Map<string, Set<TradeUpdateCallback>> = new Map(); // marketId -> callbacks

  constructor(wsUrl: string = 'wss://ws-subscriptions-clob.polymarket.com/ws/') {
    this.wsUrl = wsUrl;
  }

  /**
   * Connect to the Polymarket CLOB WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);
      } catch (err) {
        return reject(err);
      }

      this.ws.on('open', () => {
        this.isConnected = true;
        console.log(`Connected to CLOB WebSocket at ${this.wsUrl}`);
        this.resubscribeAll();
        resolve();
      });

      this.ws.on('message', (rawData: WebSocket.RawData) => {
        try {
          const data = JSON.parse(rawData.toString());
          this.handleMessage(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        console.log('CLOB WebSocket connection closed.');
        if (this.autoReconnect) {
          console.log('Reconnecting in 3 seconds...');
          setTimeout(() => {
            if (this.autoReconnect) {
              this.connect().catch(console.error);
            }
          }, 3000);
        }
      });

      this.ws.on('error', (err) => {
        console.error('CLOB WebSocket error:', err);
        reject(err);
      });
    });
  }

  /**
   * Close the WebSocket connection and stop reconnecting
   */
  disconnect() {
    this.autoReconnect = false;
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Subscribe to order book depth updates for a market
   */
  subscribeToBook(marketId: string, callback: BookUpdateCallback) {
    if (!this.bookCallbacks.has(marketId)) {
      this.bookCallbacks.set(marketId, new Set());
    }
    this.bookCallbacks.get(marketId)!.add(callback);

    const subKey = `order_book_depth:${marketId}`;
    if (!this.subscriptions.has(subKey)) {
      this.subscriptions.add(subKey);
      this.sendSubscription('subscribe', ['order_book_depth'], [marketId]);
    }
  }

  /**
   * Subscribe to trade stream updates for a market
   */
  subscribeToTrades(marketId: string, callback: TradeUpdateCallback) {
    if (!this.tradeCallbacks.has(marketId)) {
      this.tradeCallbacks.set(marketId, new Set());
    }
    this.tradeCallbacks.get(marketId)!.add(callback);

    const subKey = `trades:${marketId}`;
    if (!this.subscriptions.has(subKey)) {
      this.subscriptions.add(subKey);
      this.sendSubscription('subscribe', ['trades'], [marketId]);
    }
  }

  /**
   * Unsubscribe from book updates for a market
   */
  unsubscribeFromBook(marketId: string, callback: BookUpdateCallback) {
    const callbacks = this.bookCallbacks.get(marketId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.bookCallbacks.delete(marketId);
        const subKey = `order_book_depth:${marketId}`;
        this.subscriptions.delete(subKey);
        this.sendSubscription('unsubscribe', ['order_book_depth'], [marketId]);
      }
    }
  }

  /**
   * Unsubscribe from trades for a market
   */
  unsubscribeFromTrades(marketId: string, callback: TradeUpdateCallback) {
    const callbacks = this.tradeCallbacks.get(marketId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.tradeCallbacks.delete(marketId);
        const subKey = `trades:${marketId}`;
        this.subscriptions.delete(subKey);
        this.sendSubscription('unsubscribe', ['trades'], [marketId]);
      }
    }
  }

  private handleMessage(data: any) {
    const channel = data.channel || data.topic;
    const marketId = data.market_id || data.market;

    if (!channel || !marketId) return;

    if (channel === 'order_book_depth') {
      const callbacks = this.bookCallbacks.get(marketId);
      if (callbacks) {
        callbacks.forEach((cb) => cb(data as WsOrderBookUpdate));
      }
    } else if (channel === 'trades') {
      const callbacks = this.tradeCallbacks.get(marketId);
      if (callbacks) {
        callbacks.forEach((cb) => cb(data as WsTradeUpdate));
      }
    }
  }

  private sendSubscription(type: 'subscribe' | 'unsubscribe', channels: string[], marketIds: string[]) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      type,
      channels,
      market_ids: marketIds,
    };

    this.ws.send(JSON.stringify(payload));
  }

  private resubscribeAll() {
    if (this.subscriptions.size === 0) return;

    const books: string[] = [];
    const trades: string[] = [];

    this.subscriptions.forEach((subKey) => {
      const [channel, marketId] = subKey.split(':');
      if (channel === 'order_book_depth') {
        books.push(marketId);
      } else if (channel === 'trades') {
        trades.push(marketId);
      }
    });

    if (books.length > 0) {
      this.sendSubscription('subscribe', ['order_book_depth'], books);
    }
    if (trades.length > 0) {
      this.sendSubscription('subscribe', ['trades'], trades);
    }
  }
}
