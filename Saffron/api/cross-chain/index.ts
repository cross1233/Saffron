/**
 * Cross-chain main entry file
 * Integrates Base -> Aptos complete cross-chain flow with real-time progress callbacks
 */
import { ethers } from 'ethers';
import { BaseCCTPSender } from './base-sender';
import { CircleAttestationService } from './circle-attestation';
import { AptosCCTPReceiver } from './aptos-receiver';
import { CROSS_CHAIN_CONFIG, CREDENTIALS } from './config';

/**
 * Cross-chain progress information
 */
export interface CrossChainProgress {
  step: number;           // Current step 1/2/3
  totalSteps: number;     // Total steps 3
  status: 'processing' | 'completed' | 'failed';
  message: string;        // Status description
  txHash?: string;        // Transaction hash
  details?: string;       // Detailed information
  percentage?: number;    // Progress percentage 0-100
}

/**
 * Cross-chain result
 */
export interface CrossChainResult {
  success: boolean;
  baseTxHash?: string;
  aptosTxHash?: string;
  usdcAmount?: string;
  error?: string;
}

/**
 * Execute complete cross-chain flow
 * @param onProgress Progress callback function
 * @returns Cross-chain result
 */
export async function executeCrossChain(
  onProgress: (progress: CrossChainProgress) => void
): Promise<CrossChainResult> {
  console.log('🚀 ========== executeCrossChain started ==========');

  try {
    // console.log('📋 Checking environment variables...');
    // console.log('BASE_PRIVATE_KEY:', CREDENTIALS.BASE_PRIVATE_KEY ? 'Set ✅' : 'Not set ❌');
    // console.log('APTOS_PRIVATE_KEY:', CREDENTIALS.APTOS_PRIVATE_KEY ? 'Set ✅' : 'Not set ❌');
    // console.log('APTOS_RECIPIENT:', CREDENTIALS.APTOS_RECIPIENT ? 'Set ✅' : 'Not set ❌');

    // // Validate environment variables
    // if (!CREDENTIALS.BASE_PRIVATE_KEY || !CREDENTIALS.APTOS_PRIVATE_KEY || !CREDENTIALS.APTOS_RECIPIENT) {
    //   console.log('❌ Missing environment variables!');
    //   throw new Error('Missing necessary environment variable configuration');
    // }

    // console.log('✅ Environment variables check passed');
    // console.log('💰 Cross-chain amount:', CROSS_CHAIN_CONFIG.USDC_AMOUNT, 'USDC');

    // Initialize services
    console.log('🔧 Initializing services...');
    const baseProvider = new ethers.JsonRpcProvider(CROSS_CHAIN_CONFIG.BASE_SEPOLIA.rpcUrl);
    const baseSigner = new ethers.Wallet(CREDENTIALS.BASE_PRIVATE_KEY, baseProvider);
    const baseSender = new BaseCCTPSender();
    const attestationService = new CircleAttestationService();
    const aptosReceiver = new AptosCCTPReceiver();
    console.log('✅ Services initialization completed');

    // ========== Step 1/3: Base chain burn USDC ==========
    console.log('📍 Step 1/3: Starting Base chain operation');
    onProgress({
      step: 1,
      totalSteps: 3,
      status: 'processing',
      message: 'Burning USDC on Base chain...',
      percentage: 10
    });

    console.log('🔥 Calling baseSender.executeFullCrossChain...');
    const sendResult = await baseSender.executeFullCrossChain(
      baseSigner,
      CROSS_CHAIN_CONFIG.USDC_AMOUNT,
      CREDENTIALS.APTOS_RECIPIENT
    );
    console.log('✅ Step 1 completed! TxHash:', sendResult.txHash);

    onProgress({
      step: 1,
      totalSteps: 3,
      status: 'completed',
      message: 'Base chain transaction successful',
      txHash: sendResult.txHash,
      percentage: 33
    });

    // ========== Step 2/3: Wait for Circle signature ==========
    console.log('📍 Step 2/3: Starting Circle signature retrieval');
    onProgress({
      step: 2,
      totalSteps: 3,
      status: 'processing',
      message: 'Waiting for Circle signature...',
      percentage: 40
    });

    console.log('🔐 Calling attestationService.getAttestationFromTransaction...');
    const attestationData = await attestationService.getAttestationFromTransaction(
      sendResult.txHash,
      baseProvider
    );
    console.log('✅ Step 2 completed! Attestation retrieved successfully');

    onProgress({
      step: 2,
      totalSteps: 3,
      status: 'completed',
      message: 'Circle signature retrieved successfully',
      percentage: 66
    });

    // ========== Step 3/3: Aptos chain receive USDC ==========
    console.log('📍 Step 3/3: Starting Aptos chain receive');
    onProgress({
      step: 3,
      totalSteps: 3,
      status: 'processing',
      message: 'Receiving USDC on Aptos chain...',
      percentage: 75
    });

    console.log('📥 Calling aptosReceiver.receiveCCTPUSDC...');
    const receiveResult = await aptosReceiver.receiveCCTPUSDC(
      attestationData.messageBytes,
      attestationData.attestation,
      CREDENTIALS.APTOS_PRIVATE_KEY
    );
    // console.log('Aptos receive result:', receiveResult);

    if (!receiveResult.success) {
      console.log('❌ Aptos receive failed');
      throw new Error('Aptos receive failed');
    }

    console.log('✅ Step 3 completed! Aptos TxHash:', receiveResult.txHash);

    onProgress({
      step: 3,
      totalSteps: 3,
      status: 'completed',
      message: 'Cross-chain completed!',
      txHash: receiveResult.txHash,
      percentage: 100
    });

    // Return final result
    const finalResult = {
      success: true,
      baseTxHash: sendResult.txHash,
      aptosTxHash: receiveResult.txHash,
      usdcAmount: CROSS_CHAIN_CONFIG.USDC_AMOUNT
    };
    console.log('🎉 ========== Cross-chain completed! Final result ==========');
    console.log(finalResult);
    return finalResult;

  } catch (error: any) {
    console.log('❌ ========== Cross-chain failed! Error information ==========');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Error handling
    onProgress({
      step: 0,
      totalSteps: 3,
      status: 'failed',
      message: 'Cross-chain failed',
      details: error.message,
      percentage: 0
    });

    return {
      success: false,
      error: error.message
    };
  }
}

// Export configuration
export { CROSS_CHAIN_CONFIG, CREDENTIALS };
