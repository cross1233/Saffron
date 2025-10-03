/**
 * Cross-chain configuration file
 */
import { BASE_PRIVATE_KEY, APTOS_PRIVATE_KEY, APTOS_RECIPIENT } from '@env';

export const CROSS_CHAIN_CONFIG = {
  // Fixed cross-chain amount (USDC)
  USDC_AMOUNT: '1.0',

  // Base Sepolia configuration
  BASE_SEPOLIA: {
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    domainId: 6,
    contracts: {
      tokenMessengerV2: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
      messageTransmitterV2: '0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c',
      usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
    }
  },

  // Aptos Testnet configuration
  APTOS_TESTNET: {
    network: 'testnet',
    rpcUrl: 'https://fullnode.testnet.aptoslabs.com',
    domainId: 9,
    packages: {
      messageTransmitter: '0x081e86cebf457a0c6004f35bd648a2794698f52e0dde09a48619dcd3d4cc23d9',
      tokenMessengerMinter: '0x5f9b937419dda90aa06c1836b7847f65bbbe3f1217567758dc2488be31a477b9'
    },
    objects: {
      messageTransmitter: '0xcbb70e4f5d89b4a37e850c22d7c994e32c31e9cf693e9633784e482e9a879e0c',
      tokenMessengerMinter: '0x1fbf4458a00a842a4774f441fac7a41f2da0488dd93a43880e76d58789144e17',
      usdc: '0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832'
    }
  },

  // Circle API configuration
  CIRCLE_API: {
    baseUrl: 'https://iris-api-sandbox.circle.com',
    pollInterval: 2000,      // Poll every 2 seconds
    maxRetries: 150,         // Maximum 150 retries (5 minutes)
    maxWaitTime: 300000      // Maximum wait 5 minutes
  }
};

// Read sensitive information from environment variables
export const CREDENTIALS = {
  // Base Sepolia private key
  BASE_PRIVATE_KEY: BASE_PRIVATE_KEY,

  // Aptos Testnet private key
  APTOS_PRIVATE_KEY: APTOS_PRIVATE_KEY,

  // Aptos recipient address
  APTOS_RECIPIENT: APTOS_RECIPIENT,
};
