/**
 * Ekiden API integration for Aptos perp DEX trading
 * Documentation: https://docs.ekiden.fi/api-reference/user/send-a-new-intent
 */

export interface EkidenAuthResponse {
  token: string;
}

export interface EkidenOrder {
  is_cross: boolean;
  leverage: number;
  market_addr: string;
  price: number;
  side: 'buy' | 'sell';
  size: number;
  type: 'limit' | 'market';
}

export interface EkidenIntent {
  nonce: number;
  payload: {
    orders: EkidenOrder[];
    type: 'order_create' | 'order_cancel' | 'leverage_assign';
  };
  signature: string;
}

export interface EkidenIntentResponse {
  output: {
    outputs: Array<{ sid: string }>;
    type: string;
  };
  seq: number;
  timestamp: number;
  version: number;
}

export interface MarketInfo {
  symbol: string;
  market_addr: string;
  base_currency: string;
  quote_currency: string;
  min_size: number;
  max_size: number;
  tick_size: number;
  current_price?: number;
}

// Aptos perp markets available on Ekiden
export const EKIDEN_MARKETS: Record<string, MarketInfo> = {
  'APT': {
    symbol: 'APT',
    market_addr: '0x1::market::APT_USD',
    base_currency: 'APT',
    quote_currency: 'USD',
    min_size: 0.1,
    max_size: 10000,
    tick_size: 0.001,
  },
  'BTC': {
    symbol: 'BTC',
    market_addr: '0x1::market::BTC_USD',
    base_currency: 'BTC',
    quote_currency: 'USD',
    min_size: 0.001,
    max_size: 100,
    tick_size: 0.01,
  },
  'ETH': {
    symbol: 'ETH',
    market_addr: '0x1::market::ETH_USD',
    base_currency: 'ETH',
    quote_currency: 'USD',
    min_size: 0.01,
    max_size: 1000,
    tick_size: 0.01,
  },
  'SOL': {
    symbol: 'SOL',
    market_addr: '0x1::market::SOL_USD',
    base_currency: 'SOL',
    quote_currency: 'USD',
    min_size: 0.1,
    max_size: 5000,
    tick_size: 0.001,
  },
  'SUI': {
    symbol: 'SUI',
    market_addr: '0x1::market::SUI_USD',
    base_currency: 'SUI',
    quote_currency: 'USD',
    min_size: 1,
    max_size: 50000,
    tick_size: 0.0001,
  },
};

export class EkidenAPI {
  private baseUrl = 'https://api.ekiden.fi/api/v1';
  private authToken?: string;

  constructor(authToken?: string) {
    this.authToken = authToken;
  }

  /**
   * Authenticate with Ekiden API using public key and signature
   */
  async authenticate(publicKey: string, signature: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_key: publicKey,
        signature: signature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const data: EkidenAuthResponse = await response.json();
    this.authToken = data.token;
    return data.token;
  }

  /**
   * Send a trading intent to Ekiden
   */
  async sendIntent(intent: EkidenIntent): Promise<EkidenIntentResponse> {
    if (!this.authToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const response = await fetch(`${this.baseUrl}/user/intent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(intent),
    });

    if (!response.ok) {
      throw new Error(`Intent submission failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a market order
   */
  async createMarketOrder(
    symbol: string,
    side: 'buy' | 'sell',
    size: number,
    leverage: number = 1,
    nonce: number,
    signature: string
  ): Promise<EkidenIntentResponse> {
    const market = EKIDEN_MARKETS[symbol.toUpperCase()];
    if (!market) {
      throw new Error(`Unsupported market: ${symbol}`);
    }

    const order: EkidenOrder = {
      is_cross: true,
      leverage,
      market_addr: market.market_addr,
      price: 0, // Market order
      side,
      size,
      type: 'market',
    };

    const intent: EkidenIntent = {
      nonce,
      payload: {
        orders: [order],
        type: 'order_create',
      },
      signature,
    };

    return this.sendIntent(intent);
  }

  /**
   * Create a limit order
   */
  async createLimitOrder(
    symbol: string,
    side: 'buy' | 'sell',
    size: number,
    price: number,
    leverage: number = 1,
    nonce: number,
    signature: string
  ): Promise<EkidenIntentResponse> {
    const market = EKIDEN_MARKETS[symbol.toUpperCase()];
    if (!market) {
      throw new Error(`Unsupported market: ${symbol}`);
    }

    const order: EkidenOrder = {
      is_cross: true,
      leverage,
      market_addr: market.market_addr,
      price,
      side,
      size,
      type: 'limit',
    };

    const intent: EkidenIntent = {
      nonce,
      payload: {
        orders: [order],
        type: 'order_create',
      },
      signature,
    };

    return this.sendIntent(intent);
  }

  /**
   * Get market information for a symbol
   */
  getMarketInfo(symbol: string): MarketInfo | null {
    return EKIDEN_MARKETS[symbol.toUpperCase()] || null;
  }

  /**
   * Get all available markets
   */
  getAllMarkets(): MarketInfo[] {
    return Object.values(EKIDEN_MARKETS);
  }

  /**
   * Validate order parameters
   */
  validateOrder(symbol: string, size: number, price?: number): { valid: boolean; error?: string } {
    const market = this.getMarketInfo(symbol);
    if (!market) {
      return { valid: false, error: `Market ${symbol} not supported` };
    }

    if (size < market.min_size) {
      return { valid: false, error: `Size ${size} below minimum ${market.min_size}` };
    }

    if (size > market.max_size) {
      return { valid: false, error: `Size ${size} above maximum ${market.max_size}` };
    }

    if (price && price % market.tick_size !== 0) {
      return { valid: false, error: `Price must be multiple of tick size ${market.tick_size}` };
    }

    return { valid: true };
  }
}

export default EkidenAPI;
