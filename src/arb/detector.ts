import { WsOrderBookUpdate } from '../clob/websocket.js';

export interface MarketState {
  bestBid: number;
  bestAsk: number;
  bidSize: number;
  askSize: number;
}

export interface ArbOpportunity {
  type: 'underpriced_basket' | 'overpriced_basket';
  eventId: string;
  totalPrice: number;
  threshold: number;
  profitPotential: number;
  markets: {
    marketId: string;
    price: number;
    size: number;
  }[];
}

export type ArbCallback = (opportunity: ArbOpportunity) => void;

/**
 * ArbDetector identifies arbitrage opportunities in Polymarket Negative Risk events.
 * It tracks the order book state for constituent markets and triggers a callback
 * when mathematical conditions for profit are met.
 */
export class ArbDetector {
  private marketStates: Map<string, MarketState> = new Map(); // marketId -> state
  private eventMarkets: Map<string, string[]> = new Map(); // eventId -> marketIds
  private marketToEvent: Map<string, string> = new Map(); // marketId -> eventId
  
  private takerFee: number;
  private minProfitThreshold: number;
  private callback: ArbCallback;

  constructor(
    callback: ArbCallback,
    takerFee: number = 0.0015,
    minProfitThreshold: number = 0.0001
  ) {
    this.callback = callback;
    this.takerFee = takerFee;
    this.minProfitThreshold = minProfitThreshold;
  }

  /**
   * Register a Negative Risk event and its constituent markets.
   * This is required so the detector knows which markets to group together.
   */
  registerNegRiskEvent(eventId: string, marketIds: string[]) {
    this.eventMarkets.set(eventId, marketIds);
    for (const id of marketIds) {
      this.marketToEvent.set(id, eventId);
    }
  }

  /**
   * Handle an incoming order book update from the WebSocket.
   */
  handleBookUpdate(update: WsOrderBookUpdate) {
    const marketId = update.market_id;
    const eventId = this.marketToEvent.get(marketId);
    
    // If this market isn't registered to an event we're tracking, ignore it.
    if (!eventId) return;

    const bestBid = update.bids.length > 0 ? parseFloat(update.bids[0].price) : 0;
    const bidSize = update.bids.length > 0 ? parseFloat(update.bids[0].size) : 0;
    
    // For asks, if empty, we assume it's "unavailable" (price 1.0 but no size)
    const bestAsk = update.asks.length > 0 ? parseFloat(update.asks[0].price) : 1.0;
    const askSize = update.asks.length > 0 ? parseFloat(update.asks[0].size) : 0;

    this.marketStates.set(marketId, { bestBid, bestAsk, bidSize, askSize });

    this.checkForArb(eventId);
  }

  /**
   * Check for arbitrage opportunities within a specific event.
   */
  private checkForArb(eventId: string) {
    const marketIds = this.eventMarkets.get(eventId);
    if (!marketIds) return;

    let sumAsks = 0;
    let sumBids = 0;
    let minAskSize = Infinity;
    let minBidSize = Infinity;
    const marketsData: { marketId: string; state: MarketState }[] = [];

    // All markets in the NegRisk event must have data before we can check the sum
    for (const mid of marketIds) {
      const state = this.marketStates.get(mid);
      if (!state) return;

      sumAsks += state.bestAsk;
      sumBids += state.bestBid;
      minAskSize = Math.min(minAskSize, state.askSize);
      minBidSize = Math.min(minBidSize, state.bidSize);
      marketsData.push({ marketId: mid, state });
    }

    // 1. Underpriced Basket (Buy YES for every outcome)
    // Condition: Sum(Asks) < 1.0 - Fees
    const underpricedThreshold = 1.0 - this.takerFee;
    if (minAskSize > 0 && sumAsks < underpricedThreshold - this.minProfitThreshold) {
      const profit = underpricedThreshold - sumAsks;
      this.callback({
        type: 'underpriced_basket',
        eventId,
        totalPrice: sumAsks,
        threshold: underpricedThreshold,
        profitPotential: profit,
        markets: marketsData.map(m => ({
          marketId: m.marketId,
          price: m.state.bestAsk,
          size: minAskSize
        }))
      });
    }

    // 2. Overpriced Basket (Sell YES for every outcome)
    // This is equivalent to splitting 1 pUSD into all outcomes and selling them.
    // Condition: Sum(Bids) > 1.0 + Fees
    const overpricedThreshold = 1.0 + this.takerFee;
    if (minBidSize > 0 && sumBids > overpricedThreshold + this.minProfitThreshold) {
      const profit = sumBids - overpricedThreshold;
      this.callback({
        type: 'overpriced_basket',
        eventId,
        totalPrice: sumBids,
        threshold: overpricedThreshold,
        profitPotential: profit,
        markets: marketsData.map(m => ({
          marketId: m.marketId,
          price: m.state.bestBid,
          size: minBidSize
        }))
      });
    }
  }
}
