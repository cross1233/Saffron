/**
 * Circle Attestation service (simplified version)
 */
import { ethers } from 'ethers';
import { CROSS_CHAIN_CONFIG } from './config';

export interface AttestationData {
  status: 'pending' | 'complete' | 'failed';
  messageHash: string;
  messageBytes: string;
  attestation: string;
}

/**
 * Circle Attestation service
 */
export class CircleAttestationService {
  /**
   * Extract message hash from transaction (with retry mechanism)
   */
  async extractMessageHash(txHash: string, provider: ethers.Provider): Promise<{
    messageHash: string;
    messageBytes: string;
  }> {
    console.log('📝 Starting to extract message hash, txHash:', txHash);

    // Retry getting transaction receipt (wait up to 30 seconds)
    let receipt = null;
    const maxRetries = 15;
    for (let i = 0; i < maxRetries; i++) {
      console.log(`🔍 Attempting to get transaction receipt (${i + 1}/${maxRetries})...`);
      receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        console.log('✅ Successfully obtained transaction receipt');
        break;
      }
      console.log('⏳ Waiting 2 seconds before retry...');
      await this.sleep(2000);
    }

    if (!receipt) {
      throw new Error('Unable to get transaction receipt, please try again later');
    }

    // Check if transaction was successful
    if (receipt.status === 0) {
      throw new Error('Transaction execution failed');
    }

    console.log('🔍 Looking for MessageSent event...');
    const messageSentSignature = 'MessageSent(bytes)';
    const messageSentTopic = ethers.id(messageSentSignature);
    const messageSentLog = receipt.logs.find(log => log.topics[0] === messageSentTopic);

    if (!messageSentLog) {
      console.error('❌ MessageSent event not found, receipt logs:', receipt.logs);
      throw new Error('MessageSent event not found');
    }

    console.log('✅ Found MessageSent event');
    const abiCoder = new ethers.AbiCoder();
    const decodedData = abiCoder.decode(['bytes'], messageSentLog.data);
    const messageBytes = decodedData[0] as string;
    const messageHash = ethers.keccak256(messageBytes);

    console.log('✅ Message hash:', messageHash);
    console.log('✅ Message bytes length:', messageBytes.length);

    return { messageHash, messageBytes };
  }

  /**
   * Get Circle signature (polling)
   */
  async getAttestation(messageHash: string): Promise<AttestationData> {
    console.log('🔐 Starting to get Circle signature...');
    console.log('📝 Message Hash:', messageHash);

    const startTime = Date.now();
    let retries = 0;

    while (retries < CROSS_CHAIN_CONFIG.CIRCLE_API.maxRetries) {
      const elapsed = Date.now() - startTime;
      if (elapsed > CROSS_CHAIN_CONFIG.CIRCLE_API.maxWaitTime) {
        throw new Error(`Getting attestation timeout (waited ${Math.round(elapsed / 1000)} seconds)`);
      }

      try {
        console.log(`🔍 Polling Circle API (${retries + 1}/${CROSS_CHAIN_CONFIG.CIRCLE_API.maxRetries})...`);
        const url = `${CROSS_CHAIN_CONFIG.CIRCLE_API.baseUrl}/v1/attestations/${messageHash}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Signature not generated yet, continue waiting
            console.log('⏳ Signature not generated yet, waiting 2 seconds before retry...');
            await this.sleep(CROSS_CHAIN_CONFIG.CIRCLE_API.pollInterval);
            retries++;
            continue;
          } else {
            throw new Error(`Circle API error: ${response.status}`);
          }
        }

        const data = await response.json() as any;
        console.log('📦 Circle API response:', data);

        if (data.status === 'complete' && data.attestation) {
          console.log('✅ Successfully obtained Circle signature!');
          return {
            status: 'complete',
            messageHash: messageHash,
            messageBytes: data.message || '',
            attestation: data.attestation
          };
        }

        console.log(`⏳ Signature status: ${data.status}, continuing to wait...`);
        await this.sleep(CROSS_CHAIN_CONFIG.CIRCLE_API.pollInterval);
        retries++;
      } catch (error) {
        console.error(`❌ Attempt ${retries + 1} failed:`, error);
        if (retries === CROSS_CHAIN_CONFIG.CIRCLE_API.maxRetries - 1) {
          throw error;
        }
        await this.sleep(CROSS_CHAIN_CONFIG.CIRCLE_API.pollInterval);
        retries++;
      }
    }

    throw new Error('Getting attestation exceeded maximum retry attempts');
  }

  /**
   * Complete flow: extract message + get signature
   */
  async getAttestationFromTransaction(
    txHash: string,
    provider: ethers.Provider
  ): Promise<AttestationData> {
    // 1. Extract message
    const { messageHash, messageBytes } = await this.extractMessageHash(txHash, provider);

    // 2. Get signature
    const attestationData = await this.getAttestation(messageHash);

    if (!attestationData.messageBytes) {
      attestationData.messageBytes = messageBytes;
    }

    return attestationData;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
