import { ethers } from 'ethers';

const CIRCLE_API_CONFIG = {
  baseUrl: 'https://iris-api-sandbox.circle.com',
  pollInterval: 2000,
  maxWaitTime: 5 * 60 * 1000,
  maxRetries: 150
};

export interface AttestationData {
  status: 'pending' | 'complete' | 'failed';
  messageHash: string;
  messageBytes: string;
  attestation: string;
}

export interface MessageSentEvent {
  messageHash: string;
  messageBytes?: string;
  nonce: string;
  sender: string;
  recipient: string;
  destinationDomain: number;
}

export class CircleAttestationService {

  async extractMessageFromTransaction(
    txHash: string,
    provider: ethers.Provider
  ): Promise<MessageSentEvent> {
    try {
      console.log('Extracting cross-chain message from transaction...', txHash);

      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error('Unable to get transaction receipt');
      }

      console.log('Transaction receipt obtained, parsing event logs...');
      console.log(`Total ${receipt.logs.length} event logs`);

      const messageSentSignature = 'MessageSent(bytes)';
      const messageSentTopic = ethers.id(messageSentSignature);

      console.log('Looking for MessageSent event, Topic0:', messageSentTopic);

      const messageSentLog = receipt.logs.find(log => log.topics[0] === messageSentTopic);

      if (!messageSentLog) {
        console.log('MessageSent event not found, printing all logs for debugging:');
        receipt.logs.forEach((log, i) => {
          console.log(`  Log ${i}:`);
          console.log(`    Address: ${log.address}`);
          console.log(`    Topic0: ${log.topics[0]}`);
          console.log(`    Data length: ${log.data.length}`);
        });
        throw new Error('MessageSent event not found. Please confirm the transaction successfully called depositForBurn');
      }

      console.log('✅ MessageSent event found');
      console.log('Event source contract:', messageSentLog.address);

      const abiCoder = new ethers.AbiCoder();
      const decodedData = abiCoder.decode(['bytes'], messageSentLog.data);
      const messageBytes = decodedData[0] as string;

      if (!messageBytes.startsWith('0x')) {
        throw new Error('Message bytes format error, should be hexadecimal string');
      }

      const messageHash = ethers.keccak256(messageBytes);

      console.log('Message extraction successful:');
      console.log('  Message hash:', messageHash);
      console.log('  Message length:', messageBytes.length, 'characters (', (messageBytes.length - 2) / 2, 'bytes)');
      console.log('  Message prefix:', messageBytes.substring(0, 66) + '...');

      const depositForBurnSignature = 'DepositForBurn(uint64,address,uint256,address,bytes32,uint32,bytes32,bytes32)';
      const depositForBurnTopic = ethers.id(depositForBurnSignature);
      const depositLog = receipt.logs.find(log => log.topics[0] === depositForBurnTopic);

      let nonce = '0';
      if (depositLog && depositLog.topics.length > 1) {
        nonce = depositLog.topics[1];
        console.log('  Nonce (from DepositForBurn):', nonce);
      }

      return {
        messageHash,
        messageBytes: messageBytes,
        nonce: nonce,
        sender: receipt.from,
        recipient: '',
        destinationDomain: 9,
      };

    } catch (error) {
      console.error('Failed to extract cross-chain message:', error);
      throw error;
    }
  }

  async getAttestation(messageHash: string, txHash?: string, provider?: ethers.Provider): Promise<AttestationData> {
    try {
      console.log('Starting to get Circle attestation...', messageHash);

      const startTime = Date.now();
      let retries = 0;

      while (retries < CIRCLE_API_CONFIG.maxRetries) {
        try {
          if (Date.now() - startTime > CIRCLE_API_CONFIG.maxWaitTime) {
            throw new Error('Getting attestation timeout');
          }

          console.log(`Attempt ${retries + 1} to get attestation...`);

          const response = await fetch(
            `${CIRCLE_API_CONFIG.baseUrl}/v1/attestations/${messageHash}`,
            {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              },
            }
          );

          if (!response.ok) {
            if (response.status === 404) {
              console.log('Message still being processed, waiting for Circle signature...');
              await this.sleep(CIRCLE_API_CONFIG.pollInterval);
              retries++;
              continue;
            } else {
              throw new Error(`Circle API error: ${response.status} ${response.statusText}`);
            }
          }

          const data = await response.json() as any;

          if (data.status === 'complete' && data.attestation) {
            console.log('✅ Attestation obtained successfully!');
            let messageBytes = data.message || '';
            
            if (!messageBytes && txHash && provider) {
              try {
                const messageEvent = await this.extractMessageFromTransaction(txHash, provider);
                messageBytes = messageEvent.messageBytes || '';
              } catch (error) {
                console.warn('Failed to extract message bytes from transaction:', error);
              }
            }
            
            return {
              status: 'complete',
              messageHash: messageHash,
              messageBytes: messageBytes,
              attestation: data.attestation
            };
          } else if (data.status === 'failed') {
            throw new Error('Circle signature failed');
          } else {
            console.log('Circle is processing the message, continuing to wait...');
            await this.sleep(CIRCLE_API_CONFIG.pollInterval);
            retries++;
          }

        } catch (error) {
          if (retries === CIRCLE_API_CONFIG.maxRetries - 1) {
            throw error;
          }
          console.log('Request failed, retrying...', error);
          await this.sleep(CIRCLE_API_CONFIG.pollInterval);
          retries++;
        }
      }

      throw new Error('Getting attestation exceeded maximum retry attempts');

    } catch (error) {
      console.error('Failed to get attestation:', error);
      throw error;
    }
  }

  async getAttestationFromTransaction(
    txHash: string,
    provider: ethers.Provider
  ): Promise<AttestationData> {
    try {
      console.log('🔄 Starting complete attestation retrieval process...');

      const messageEvent = await this.extractMessageFromTransaction(txHash, provider);

      const attestationData = await this.getAttestation(messageEvent.messageHash, txHash, provider);
      
      if (!attestationData.messageBytes) {
        attestationData.messageBytes = messageEvent.messageBytes || '';
      }

      console.log('🎉 Complete process finished!');
      return attestationData;

    } catch (error) {
      console.error('❌ Attestation retrieval process failed:', error);
      throw error;
    }
  }

  validateAttestationData(data: AttestationData): boolean {
    return (
      data.status === 'complete' &&
      data.messageHash.length === 66 &&
      data.messageBytes.length > 0 &&
      data.attestation.length > 0
    );
  }

  async checkAttestationStatus(messageHash: string): Promise<AttestationData> {
    try {
      const response = await fetch(
        `${CIRCLE_API_CONFIG.baseUrl}/v1/attestations/${messageHash}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (response.status === 404) {
        return {
          status: 'pending',
          messageHash,
          messageBytes: '',
          attestation: ''
        };
      }

      if (!response.ok) {
        throw new Error(`Circle API error: ${response.status}`);
      }

      const data = await response.json() as any;
      return {
        status: data.status,
        messageHash,
        messageBytes: data.message || '',
        attestation: data.attestation || ''
      };

    } catch (error) {
      console.error('Failed to check attestation status:', error);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getEstimatedWaitTime(): string {
    return 'Usually takes 1-3 minutes, maximum wait 5 minutes';
  }
}

export const circleAttestationService = new CircleAttestationService();