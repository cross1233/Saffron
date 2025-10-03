/**
 * Base chain USDC sender (simplified version, adapted for React Native)
 */
import { ethers } from 'ethers';
import { CROSS_CHAIN_CONFIG } from './config';

// TokenMessenger contract ABI
const TOKEN_MESSENGER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint32', name: 'destinationDomain', type: 'uint32' },
      { internalType: 'bytes32', name: 'mintRecipient', type: 'bytes32' },
      { internalType: 'address', name: 'burnToken', type: 'address' }
    ],
    name: 'depositForBurn',
    outputs: [{ internalType: 'uint64', name: '_nonce', type: 'uint64' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

// USDC ERC20 contract ABI
const USDC_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  }
];

/**
 * Convert Aptos address to bytes32 format
 */
function aptosAddressToBytes32(aptosAddress: string): string {
  const cleanAddress = aptosAddress.replace('0x', '');
  if (cleanAddress.length !== 64) {
    throw new Error('Invalid Aptos address length');
  }
  return '0x' + cleanAddress;
}

export interface BaseSendResult {
  txHash: string;
  nonce: string;
  messageBytes?: string;
}

/**
 * Base chain USDC sender
 */
export class BaseCCTPSender {
  private provider: ethers.Provider;
  private tokenMessengerContract: ethers.Contract;
  private usdcContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(CROSS_CHAIN_CONFIG.BASE_SEPOLIA.rpcUrl);

    this.tokenMessengerContract = new ethers.Contract(
      CROSS_CHAIN_CONFIG.BASE_SEPOLIA.contracts.tokenMessengerV2,
      TOKEN_MESSENGER_ABI,
      this.provider
    );

    this.usdcContract = new ethers.Contract(
      CROSS_CHAIN_CONFIG.BASE_SEPOLIA.contracts.usdc,
      USDC_ABI,
      this.provider
    );
  }

  /**
   * Approve USDC transfer
   */
  async approveUSDC(signer: ethers.Signer, amount: string, nonce?: number): Promise<string> {
    const usdcWithSigner = this.usdcContract.connect(signer);
    const decimals = await this.usdcContract.decimals();

    // If no nonce provided, get the latest
    if (nonce === undefined) {
      console.log('🔍 Getting latest nonce (approve)...');
      nonce = await signer.getNonce('latest');
      console.log('📊 Current nonce (approve):', nonce);
    } else {
      console.log('📊 Using provided nonce (approve):', nonce);
    }

    const approveTx = await (usdcWithSigner as any).approve(
      CROSS_CHAIN_CONFIG.BASE_SEPOLIA.contracts.tokenMessengerV2,
      ethers.MaxUint256,
      {
        nonce: nonce  // Manually specify using the latest nonce
      }
    );

    console.log('⏳ Waiting for approve confirmation...');
    await approveTx.wait();
    console.log('✅ Approve successful!');
    return approveTx.hash;
  }

  /**
   * Execute cross-chain transfer (burn USDC)
   */
  async depositForBurn(
    signer: ethers.Signer,
    amount: string,
    recipientAddress: string,
    nonce?: number
  ): Promise<BaseSendResult> {
    const contractWithSigner = this.tokenMessengerContract.connect(signer);
    const decimals = await this.usdcContract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);
    const mintRecipient = aptosAddressToBytes32(recipientAddress);

    // If no nonce provided, get the latest
    if (nonce === undefined) {
      console.log('🔍 Getting latest nonce...');
      nonce = await signer.getNonce('latest');
      console.log('📊 Current nonce:', nonce);
    } else {
      console.log('📊 Using provided nonce:', nonce);
    }

    const tx = await (contractWithSigner as any).depositForBurn(
      amountWei,
      CROSS_CHAIN_CONFIG.APTOS_TESTNET.domainId,
      mintRecipient,
      CROSS_CHAIN_CONFIG.BASE_SEPOLIA.contracts.usdc,
      {
        nonce: nonce  // Manually specify using the latest nonce
      }
    );

    console.log('⏳ Waiting for transaction confirmation...');
    const receipt = await tx.wait();

    // Extract message
    const messageSentSignature = 'MessageSent(bytes)';
    const messageSentTopic = ethers.id(messageSentSignature);
    const messageSentLog = receipt.logs.find((log: any) => log.topics[0] === messageSentTopic);

    if (!messageSentLog) {
      throw new Error('MessageSent event not found');
    }

    const abiCoder = new ethers.AbiCoder();
    const decodedData = abiCoder.decode(['bytes'], messageSentLog.data);
    const messageBytes = decodedData[0] as string;

    // Extract nonce
    const depositForBurnSignature = 'DepositForBurn(uint64,address,uint256,address,bytes32,uint32,bytes32,bytes32)';
    const depositForBurnTopic = ethers.id(depositForBurnSignature);
    const depositLog = receipt.logs.find((log: any) => log.topics[0] === depositForBurnTopic);
    const eventNonce = depositLog ? depositLog.topics[1] : '0';

    return {
      txHash: tx.hash,
      nonce: eventNonce,
      messageBytes
    };
  }

  /**
   * One-click completion: approve + cross-chain
   */
  async executeFullCrossChain(
    signer: ethers.Signer,
    amount: string,
    recipientAddress: string
  ): Promise<BaseSendResult> {
    // Get current nonce once, manually manage increment
    console.log('🔍 Getting initial nonce...');
    const initialNonce = await signer.getNonce('latest');
    console.log('📊 Initial nonce:', initialNonce);

    // 1. Approve USDC (using nonce)
    await this.approveUSDC(signer, amount, initialNonce);

    // 2. Execute cross-chain (using nonce + 1)
    const result = await this.depositForBurn(signer, amount, recipientAddress, initialNonce + 1);

    return result;
  }
}
