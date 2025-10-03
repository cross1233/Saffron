import { ethers } from 'ethers';
import { circleAttestationService } from './circle-attestation';

const BASE_SEPOLIA_CONFIG = {
  chainId: 84532,
  rpcUrl: "https://sepolia.base.org",
  domainId: 6,
  contracts: {
    tokenMessengerV2: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    messageTransmitterV2: "0x2703483B1a5a7c577e8680de9Df8Be03c6f30e3c", 
    tokenMinterV2: "0xfd78EE919681417d192449715b2594ab58f5D002",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  }
};

const APTOS_DOMAIN_ID = 9;

const TOKEN_MESSENGER_ABI = [
  {
    "inputs": [
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "uint32", "name": "destinationDomain", "type": "uint32"},
      {"internalType": "bytes32", "name": "mintRecipient", "type": "bytes32"},
      {"internalType": "address", "name": "burnToken", "type": "address"}
    ],
    "name": "depositForBurn",
    "outputs": [
      {"internalType": "uint64", "name": "_nonce", "type": "uint64"}
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const USDC_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
];

function evmToAptosAddress(evmAddress: string): string {
  const cleanAddress = evmAddress.replace('0x', '');
  const paddedAddress = '0'.repeat(64 - cleanAddress.length) + cleanAddress;
  return '0x' + paddedAddress;
}

function aptosAddressToBytes32(aptosAddress: string): string {
  const cleanAddress = aptosAddress.replace('0x', '');
  if (cleanAddress.length !== 64) {
    throw new Error('Invalid Aptos address length');
  }
  return '0x' + cleanAddress;
}

export interface CrossChainParams {
  amount: string;
  recipientAddress: string;
  signer: ethers.Signer;
}

export interface CrossChainResult {
  txHash: string;
  nonce: string;
  messageBytes?: string;
}

export class BaseCCTPSender {
  private provider: ethers.Provider;
  private tokenMessengerContract: ethers.Contract;
  private usdcContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_CONFIG.rpcUrl);

    this.tokenMessengerContract = new ethers.Contract(
      BASE_SEPOLIA_CONFIG.contracts.tokenMessengerV2,
      TOKEN_MESSENGER_ABI,
      this.provider
    );

    this.usdcContract = new ethers.Contract(
      BASE_SEPOLIA_CONFIG.contracts.usdc,
      USDC_ABI,
      this.provider
    );
  }

  async checkUSDCBalance(userAddress: string): Promise<string> {
    try {
      const balance = await this.usdcContract.balanceOf(userAddress);
      const decimals = await this.usdcContract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Failed to check USDC balance:', error);
      throw error;
    }
  }

  async approveUSDC(params: {
    amount: string;
    signer: ethers.Signer;
  }): Promise<string> {
    try {
      console.log('Approving USDC transfer...');

      const usdcWithSigner = this.usdcContract.connect(params.signer);

      const decimals = await this.usdcContract.decimals();
      const amountWei = ethers.parseUnits(params.amount, decimals);

      const maxUint256 = ethers.MaxUint256;
      const approveTx = await (usdcWithSigner as any).approve(
        BASE_SEPOLIA_CONFIG.contracts.tokenMessengerV2,
        maxUint256
      );

      console.log('Approve transaction sent, waiting for confirmation...', approveTx.hash);
      await approveTx.wait();
      console.log('USDC approval successful!');

      return approveTx.hash;
    } catch (error) {
      console.error('USDC approval failed:', error);
      throw error;
    }
  }

  async depositForBurn(params: CrossChainParams): Promise<CrossChainResult> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Starting Base to Aptos CCTP cross-chain transfer... (attempt ${attempt}/${maxRetries})`);
        console.log('Parameters:', {
          amount: params.amount,
          recipient: params.recipientAddress,
          sender: await params.signer.getAddress()
        });

        if (!params.recipientAddress.startsWith('0x') || params.recipientAddress.length !== 66) {
          throw new Error('Invalid Aptos address format, should be 64-character hexadecimal address');
        }

        const contractWithSigner = this.tokenMessengerContract.connect(params.signer);

        const decimals = await this.usdcContract.decimals();
        const amountWei = ethers.parseUnits(params.amount, decimals);

        const mintRecipient = aptosAddressToBytes32(params.recipientAddress);

        console.log('Calling depositForBurn with parameters:', {
          amount: amountWei.toString(),
          destinationDomain: APTOS_DOMAIN_ID,
          mintRecipient,
          burnToken: BASE_SEPOLIA_CONFIG.contracts.usdc
        });

        const currentNonce = await params.signer.getNonce();
        console.log('Current account nonce:', currentNonce);

        const tx = await (contractWithSigner as any).depositForBurn(
          amountWei,
          APTOS_DOMAIN_ID,
          mintRecipient,
          BASE_SEPOLIA_CONFIG.contracts.usdc
        );

        console.log('Cross-chain transaction sent, waiting for confirmation...', tx.hash);

        await tx.wait();
        console.log('Cross-chain transaction confirmed successfully!');

        console.log('Extracting cross-chain message and nonce...');
        const messageEvent = await circleAttestationService.extractMessageFromTransaction(
          tx.hash,
          this.provider
        );

        console.log('✅ Message extraction successful');
        console.log('  Message hash:', messageEvent.messageHash);
        console.log('  Nonce:', messageEvent.nonce);

        return {
          txHash: tx.hash,
          nonce: messageEvent.nonce,
          messageBytes: messageEvent.messageBytes
        };

      } catch (error: any) {
        lastError = error;
        console.error(`Cross-chain transfer failed (attempt ${attempt}/${maxRetries}):`, error.message);

        if (error.code === 'NONCE_EXPIRED' && attempt < maxRetries) {
          console.log('Detected nonce error, waiting 2 seconds before retry...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        if (attempt === maxRetries) {
          throw error;
        }
      }
    }

    throw lastError || new Error('Cross-chain transfer failed');
  }

  async executeFullCrossChain(params: CrossChainParams): Promise<CrossChainResult> {
    try {
      const userAddress = await params.signer.getAddress();

      console.log('1. Checking USDC balance...');
      const balance = await this.checkUSDCBalance(userAddress);
      console.log(`Current USDC balance: ${balance}`);

      if (parseFloat(balance) < parseFloat(params.amount)) {
        throw new Error(`Insufficient USDC balance, current: ${balance}, required: ${params.amount}`);
      }

      console.log('2. Approving USDC transfer...');
      await this.approveUSDC({
        amount: params.amount,
        signer: params.signer
      });

      console.log('3. Executing cross-chain transfer...');
      const result = await this.depositForBurn(params);

      console.log('✅ Cross-chain transfer completed!', result);
      return result;

    } catch (error) {
      console.error('❌ Cross-chain transfer failed:', error);
      throw error;
    }
  }
}

export {
  evmToAptosAddress,
  aptosAddressToBytes32,
  BASE_SEPOLIA_CONFIG,
  APTOS_DOMAIN_ID
};