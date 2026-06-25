import { ClobClient, Market } from '../clob/client.js';
import { EventEmitter } from 'events';

export interface ScannerConfig {
  pollingIntervalMs: number;
  minLiquidity?: number;
  minVolume?: number;
  onlyNegRisk?: boolean;
}

export class MarketScanner extends EventEmitter {
  private client: ClobClient;
  private config: ScannerConfig;
  private markets: Market[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(client: ClobClient, config: ScannerConfig) {
    super();
    this.client = client;
    this.config = config;
  }

  /**
   * Start the scanner
   */
  async start(): Promise<void> {
    if (this.timer) return;
    
    console.log('Starting MarketScanner...');
    await this.scan();
    
    this.timer = setInterval(() => this.scan(), this.config.pollingIntervalMs);
  }

  /**
   * Stop the scanner
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Perform a single scan cycle
   */
  async scan(): Promise<void> {
    try {
      console.log('Scanning for markets...');
      const allMarkets = await this.client.getMarkets();
      
      const tradeableMarkets = allMarkets.filter(m => {
        // Basic filters
        const isActive = m.active && !m.closed && !m.archived && m.accepting_orders;
        if (!isActive) return false;

        // Negative Risk filter
        if (this.config.onlyNegRisk && !m.neg_risk) return false;

        // Placeholder for liquidity/volume filters
        // Currently the /markets endpoint doesn't return these directly.
        // We might need to fetch them from another source or individual market endpoints.
        // For now, we skip if they are not present or assume they pass if we can't check.
        
        return true;
      });

      this.markets = tradeableMarkets;
      this.emit('marketsUpdated', this.markets);
      console.log(`Found ${this.markets.length} tradeable markets.`);
    } catch (error) {
      console.error('Error during market scan:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get the current list of tradeable markets
   */
  getMarkets(): Market[] {
    return this.markets;
  }

  /**
   * Get tradeable markets filtered by specific criteria
   */
  getFilteredMarkets(negRiskOnly: boolean = false): Market[] {
    if (negRiskOnly) {
      return this.markets.filter(m => m.neg_risk);
    }
    return this.markets;
  }
}
