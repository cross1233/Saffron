/**
 * CCTP (Cross-Chain Transfer Protocol) integration for USDC bridging
 * Documentation: https://developers.circle.com/cctp
 */

export interface CCTPChain {
  id: number;
  name: string;
  displayName: string;
  rpcUrl: string;
  explorerUrl: string;
  usdcAddress: string;
  tokenMessengerAddress: string;
  messageTransmitterAddress: string;
  estimatedFinality: number; // minutes
}

export interface CCTPTransferRequest {
  amount: string; // USDC amount in smallest unit (6 decimals)
  destinationDomain: number;
  recipient: string; // destination address
  burnTxHash?: string;
}

export interface CCTPTransferResponse {
  attestation: string;
  messageHash: string;
  messageBody: string;
  estimatedTime: number; // seconds
  fees: {
    sourceFee: string;
    destinationFee: string;
    bridgeFee?: string;
  };
}

export interface CCTPTransferStatus {
  status: 'pending' | 'attested' | 'completed' | 'failed';
  txHash?: string;
  attestation?: string;
  estimatedCompletion?: number; // timestamp
}

// Supported CCTP chains
export const CCTP_CHAINS: Record<string, CCTPChain> = {
  ethereum: {
    id: 1,
    name: 'ethereum',
    displayName: 'Ethereum',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    explorerUrl: 'https://etherscan.io',
    usdcAddress: '0xA0b86a33E6441b8e5c7F6b8e4e4e4e4e4e4e4e4e',
    tokenMessengerAddress: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
    messageTransmitterAddress: '0x0a992d191DEeC32aFe36203Ad87D7d289a738F81',
    estimatedFinality: 15,
  },
  arbitrum: {
    id: 42161,
    name: 'arbitrum',
    displayName: 'Arbitrum',
    rpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/demo',
    explorerUrl: 'https://arbiscan.io',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenMessengerAddress: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
    messageTransmitterAddress: '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca',
    estimatedFinality: 15,
  },
  base: {
    id: 8453,
    name: 'base',
    displayName: 'Base',
    rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/demo',
    explorerUrl: 'https://basescan.org',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    tokenMessengerAddress: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
    messageTransmitterAddress: '0xAD09780d193884d503182aD4588450C416D6F9D4',
    estimatedFinality: 2,
  },
  optimism: {
    id: 10,
    name: 'optimism',
    displayName: 'Optimism',
    rpcUrl: 'https://opt-mainnet.g.alchemy.com/v2/demo',
    explorerUrl: 'https://optimistic.etherscan.io',
    usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    tokenMessengerAddress: '0x2B4069517957735bE00ceE0fadAE88a26365528f',
    messageTransmitterAddress: '0x4d41f22c5a0e5c74090899E5a8Fb597a8842b3e8',
    estimatedFinality: 15,
  },
  polygon: {
    id: 137,
    name: 'polygon',
    displayName: 'Polygon',
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/demo',
    explorerUrl: 'https://polygonscan.com',
    usdcAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    tokenMessengerAddress: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
    messageTransmitterAddress: '0xF3be9355363857F3e001be68856A2f96b4C39Ba9',
    estimatedFinality: 5,
  },
  avalanche: {
    id: 43114,
    name: 'avalanche',
    displayName: 'Avalanche',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    usdcAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    tokenMessengerAddress: '0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982',
    messageTransmitterAddress: '0x8186359aF5F57FbB40c6b14A588d2A59C0C29880',
    estimatedFinality: 2,
  },
  aptos: {
    id: 1,
    name: 'aptos',
    displayName: 'Aptos',
    rpcUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
    explorerUrl: 'https://explorer.aptoslabs.com',
    usdcAddress: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
    tokenMessengerAddress: '0x1::cctp::TokenMessenger',
    messageTransmitterAddress: '0x1::cctp::MessageTransmitter',
    estimatedFinality: 1,
  },
};

export class CCTPAPI {
  private baseUrl = 'https://iris-api.circle.com';

  /**
   * Get supported chains
   */
  getSupportedChains(): CCTPChain[] {
    return Object.values(CCTP_CHAINS);
  }

  /**
   * Get chain by name
   */
  getChain(chainName: string): CCTPChain | null {
    const normalizedName = chainName.toLowerCase();
    return CCTP_CHAINS[normalizedName] || null;
  }

  /**
   * Estimate transfer time and fees
   */
  async estimateTransfer(
    sourceChain: string,
    destinationChain: string,
    amount: string
  ): Promise<{
    estimatedTime: number;
    fees: {
      sourceFee: string;
      destinationFee: string;
      bridgeFee?: string;
    };
  }> {
    const source = this.getChain(sourceChain);
    const destination = this.getChain(destinationChain);

    if (!source || !destination) {
      throw new Error('Unsupported chain');
    }

    // Estimate based on chain finality times
    const estimatedTime = (source.estimatedFinality + destination.estimatedFinality) * 60; // seconds

    // Mock fee estimation - in production, query actual gas prices
    const fees = {
      sourceFee: '0.005', // ETH equivalent
      destinationFee: '0.003', // ETH equivalent
      bridgeFee: '0.001', // CCTP protocol fee
    };

    return {
      estimatedTime,
      fees,
    };
  }

  /**
   * Initiate USDC transfer using CCTP
   */
  async initiateTransfer(
    sourceChain: string,
    destinationChain: string,
    amount: string,
    recipient: string,
    senderAddress: string
  ): Promise<{
    txHash: string;
    messageHash: string;
    estimatedCompletion: number;
  }> {
    const source = this.getChain(sourceChain);
    const destination = this.getChain(destinationChain);

    if (!source || !destination) {
      throw new Error('Unsupported chain');
    }

    // In a real implementation, this would:
    // 1. Call the TokenMessenger contract to burn USDC
    // 2. Get the message hash from the burn transaction
    // 3. Return transaction details

    // Mock response for now
    const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    const mockMessageHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    const estimatedCompletion = Date.now() + (source.estimatedFinality * 60 * 1000);

    return {
      txHash: mockTxHash,
      messageHash: mockMessageHash,
      estimatedCompletion,
    };
  }

  /**
   * Get attestation for a burn transaction
   */
  async getAttestation(messageHash: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/attestations/${messageHash}`);
      
      if (response.status === 404) {
        return null; // Attestation not ready yet
      }

      if (!response.ok) {
        throw new Error(`Failed to get attestation: ${response.statusText}`);
      }

      const data = await response.json();
      return data.attestation;
    } catch (error) {
      console.error('Error fetching attestation:', error);
      return null;
    }
  }

  /**
   * Complete transfer by minting USDC on destination chain
   */
  async completeTransfer(
    destinationChain: string,
    messageHash: string,
    attestation: string,
    recipient: string
  ): Promise<string> {
    const destination = this.getChain(destinationChain);
    if (!destination) {
      throw new Error('Unsupported destination chain');
    }

    // In a real implementation, this would:
    // 1. Call the MessageTransmitter contract with the attestation
    // 2. Mint USDC to the recipient address
    // 3. Return the mint transaction hash

    // Mock response for now
    const mockMintTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
    return mockMintTxHash;
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(messageHash: string): Promise<CCTPTransferStatus> {
    const attestation = await this.getAttestation(messageHash);
    
    if (!attestation) {
      return {
        status: 'pending',
        estimatedCompletion: Date.now() + (15 * 60 * 1000), // 15 minutes
      };
    }

    return {
      status: 'attested',
      attestation,
      estimatedCompletion: Date.now() + (2 * 60 * 1000), // 2 minutes to complete
    };
  }

  /**
   * Validate transfer parameters
   */
  validateTransfer(
    sourceChain: string,
    destinationChain: string,
    amount: string,
    recipient: string
  ): { valid: boolean; error?: string } {
    const source = this.getChain(sourceChain);
    const destination = this.getChain(destinationChain);

    if (!source) {
      return { valid: false, error: `Unsupported source chain: ${sourceChain}` };
    }

    if (!destination) {
      return { valid: false, error: `Unsupported destination chain: ${destinationChain}` };
    }

    if (source.name === destination.name) {
      return { valid: false, error: 'Source and destination chains cannot be the same' };
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return { valid: false, error: 'Invalid amount' };
    }

    if (amountNum < 1) {
      return { valid: false, error: 'Minimum transfer amount is 1 USDC' };
    }

    if (!recipient || recipient.length < 10) {
      return { valid: false, error: 'Invalid recipient address' };
    }

    return { valid: true };
  }
}

export default CCTPAPI;
