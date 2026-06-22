import { ClobOrder } from './signer.js';

export interface Market {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  resolutionSource: string;
  endResolutionPaperDueDate: string;
  marketType: string;
  active: boolean;
  rewards: {
    creationMinSize: number;
    creationMinPrice: number;
  };
}

export interface BookLevel {
  price: string;
  size: string;
}

export interface OrderBook {
  market: string;
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface PlaceOrderResponse {
  success: boolean;
  orderID?: string;
  errorMsg?: string;
}

export class ClobClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://clob.polymarket.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch all active markets on Polymarket CLOB
   */
  async getMarkets(): Promise<Market[]> {
    const response = await fetch(`${this.baseUrl}/markets`);
    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.statusText}`);
    }
    return response.json() as Promise<Market[]>;
  }

  /**
   * Fetch order book for a specific market
   * @param marketId The market's contract/token address
   */
  async getOrderBook(marketId: string): Promise<OrderBook> {
    const response = await fetch(`${this.baseUrl}/book?market=${marketId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch order book for market ${marketId}: ${response.statusText}`);
    }
    return response.json() as Promise<OrderBook>;
  }

  /**
   * Place a new signed order on Polymarket CLOB
   * @param order The raw unsigned CLOB order message
   * @param signature The EIP-712 signature for the order
   * @param owner The wallet address of the order creator/owner
   * @param orderType "GTC" | "FOK" | "IOC" | "POST_ONLY"
   */
  async placeOrder(
    order: ClobOrder,
    signature: string,
    owner: string,
    orderType: 'GTC' | 'FOK' | 'IOC' | 'POST_ONLY' = 'GTC'
  ): Promise<PlaceOrderResponse> {
    const payload = {
      order: {
        salt: order.salt.toString(),
        signer: order.signer,
        maker: order.maker,
        taker: order.taker,
        tokenId: order.tokenId.toString(),
        makerAmount: order.makerAmount.toString(),
        takerAmount: order.takerAmount.toString(),
        expiration: order.expiration.toString(),
        nonce: order.nonce.toString(),
        feeRateBps: order.feeRateBps.toString(),
        side: order.side,
        signature,
      },
      owner,
      orderType,
    };

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        errorMsg: `Failed to place order: ${response.status} ${response.statusText} - ${errText}`,
      };
    }

    return response.json() as Promise<PlaceOrderResponse>;
  }

  /**
   * Cancel an order by ID
   * @param orderId The ID of the order to cancel
   */
  async cancelOrder(orderId: string): Promise<{ success: boolean; errorMsg?: string }> {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        errorMsg: `Failed to cancel order ${orderId}: ${response.status} ${response.statusText} - ${errText}`,
      };
    }

    return { success: true };
  }

  /**
   * Fetch active open orders for an owner
   * @param owner The wallet address of the owner
   */
  async getOpenOrders(owner: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/orders?owner=${owner}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch open orders for ${owner}: ${response.statusText}`);
    }
    return response.json() as Promise<any[]>;
  }
}
