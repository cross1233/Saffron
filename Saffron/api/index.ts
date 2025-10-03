/**
 * Simple mock API for Saffron app
 */

export interface TradePreview {
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price?: number;
  type: 'market' | 'limit';
  estimatedFees: string;
  valid: boolean;
  error?: string;
}

export interface BridgePreview {
  sourceChain: string;
  destinationChain: string;
  amount: string;
  estimatedTime: number;
  fees: {
    sourceFee: string;
    destinationFee: string;
    bridgeFee?: string;
  };
  valid: boolean;
  error?: string;
}

export class SaffronAPI {
  async getTradePreview(
    symbol: string,
    side: 'buy' | 'sell',
    size: number,
    price?: number,
    type: 'market' | 'limit' = 'market'
  ): Promise<TradePreview> {
    // Mock implementation
    const supportedTokens = ['APT', 'SOL', 'ETH', 'BTC'];
    
    if (!supportedTokens.includes(symbol)) {
      return {
        symbol,
        side,
        size,
        price,
        type,
        estimatedFees: '0',
        valid: false,
        error: `${symbol} not supported`,
      };
    }

    const mockPrice = Math.random() * 100 + 10;
    const notionalValue = size * (price || mockPrice);
    const estimatedFees = (notionalValue * 0.001).toFixed(4);

    return {
      symbol,
      side,
      size,
      price: price || mockPrice,
      type,
      estimatedFees,
      valid: true,
    };
  }

  async getBridgePreview(
    sourceChain: string,
    destinationChain: string,
    amount: string
  ): Promise<BridgePreview> {
    // Add aptos to supported chains list
    const supportedChains = ['ethereum', 'arbitrum', 'base', 'polygon', 'aptos'];

    if (!supportedChains.includes(sourceChain.toLowerCase()) || !supportedChains.includes(destinationChain.toLowerCase())) {
      return {
        sourceChain,
        destinationChain,
        amount,
        estimatedTime: 0,
        fees: { sourceFee: '0', destinationFee: '0' },
        valid: false,
        error: 'Chain not supported',
      };
    }

    return {
      sourceChain,
      destinationChain,
      amount,
      estimatedTime: 30, // 30 seconds (actual cross-chain time)
      fees: {
        sourceFee: '0.001',
        destinationFee: '0.001',
        bridgeFee: '0.001',
      },
      valid: true,
    };
  }
}

export default SaffronAPI;