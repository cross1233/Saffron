/**
 * Aptos USDC receiver (complete implementation using precompiled scripts)
 */
import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  MoveVector
} from '@aptos-labs/ts-sdk';
import { CROSS_CHAIN_CONFIG } from './config';

// Circle CCTP precompiled Move script (base64 encoded)
// This is the only way to call non-entry functions
const CCTP_SCRIPT_BASE64 = 'oRzrCwcAAAoGAQAEAgQEAwgMBRQWBypTCH1AAAABAQACAAAAAwIDAAEBBAMEAAEDBgwKAgoCAAMGDAYKAgYKAgEIAAEBE21lc3NhZ2VfdHJhbnNtaXR0ZXIPdG9rZW5fbWVzc2VuZ2VyB1JlY2VpcHQPcmVjZWl2ZV9tZXNzYWdlFmhhbmRsZV9yZWNlaXZlX21lc3NhZ2UIHobOv0V6DGAE81vWSKJ5Rpj1Lg3eCaSGGdzT1Mwj2V+bk3QZ3akKoGwYNreEf2W7vj8SF1Z3WNwkiL4xpHe5AAABBwsADgEOAhEAEQEBAg==';

export interface AptosReceiveResult {
  txHash: string;
  success: boolean;
  usdcAmount?: string;
}

/**
 * Aptos CCTP receiver
 */
export class AptosCCTPReceiver {
  private aptos: Aptos;

  constructor() {
    const config = new AptosConfig({
      network: Network.TESTNET
    });
    this.aptos = new Aptos(config);
  }

  /**
   * Convert hexadecimal string to byte array
   */
  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.replace('0x', '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Convert base64 string to Uint8Array
   * React Native compatible implementation
   */
  private base64ToBytes(base64: string): Uint8Array {
    // In React Native, if atob is not available, use manual implementation
    let binaryString: string;
    if (typeof atob !== 'undefined') {
      binaryString = atob(base64);
    } else {
      // Manual base64 decoding implementation (fallback)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = base64.replace(/=+$/, '');
      let output = '';

      for (let i = 0; i < str.length; i += 4) {
        const enc1 = chars.indexOf(str.charAt(i));
        const enc2 = chars.indexOf(str.charAt(i + 1));
        const enc3 = chars.indexOf(str.charAt(i + 2));
        const enc4 = chars.indexOf(str.charAt(i + 3));

        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;

        output += String.fromCharCode(chr1);
        if (enc3 !== 64) output += String.fromCharCode(chr2);
        if (enc4 !== 64) output += String.fromCharCode(chr3);
      }
      binaryString = output;
    }

    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Receive CCTP USDC (complete implementation using precompiled scripts)
   */
  async receiveCCTPUSDC(
    messageBytes: string,
    attestation: string,
    privateKey: string
  ): Promise<AptosReceiveResult> {
    try {
      console.log('Starting Aptos CCTP receive...');

      // Validate input parameters
      if (!messageBytes || !messageBytes.startsWith('0x')) {
        throw new Error('Invalid message bytes format');
      }
      if (!attestation || !attestation.startsWith('0x')) {
        throw new Error('Invalid attestation format');
      }

      // Create account
      const account = Account.fromPrivateKey({
        privateKey: new Ed25519PrivateKey(privateKey)
      });
      const accountAddress = account.accountAddress.toString();
      console.log('Receiver account address:', accountAddress);

      // Check balance before receiving
      // console.log('Checking USDC balance before receiving...');
      const balanceBefore = await this.checkUSDCBalance(accountAddress);
      // console.log('USDC balance before receiving:', balanceBefore);

      // Convert parameters to Move format
      const messageBytesArray = Array.from(this.hexToBytes(messageBytes));
      const attestationArray = Array.from(this.hexToBytes(attestation));

      // console.log('Preparing to call Move contract...');
      // console.log('Message bytes length:', messageBytesArray.length);
      // console.log('Signature bytes length:', attestationArray.length);

      // Load precompiled Move script (decoded from base64)
      // console.log('Loading precompiled Move script...');
      const bytecode = this.base64ToBytes(CCTP_SCRIPT_BASE64);

      // Prepare function arguments
      const functionArguments: Array<any> = [
        MoveVector.U8(this.hexToBytes(messageBytes)),
        MoveVector.U8(this.hexToBytes(attestation))
      ];

      // console.log('Building transaction (using precompiled script)...');

      // Build transaction
      const transaction = await this.aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          bytecode,
          functionArguments,
        },
      });

      console.log('Transaction built, starting signature and submission...');

      // Sign and submit transaction
      const pendingTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      console.log('Transaction submitted, waiting for confirmation...', pendingTxn.hash);

      // Wait for transaction confirmation
      const txnResult = await this.aptos.waitForTransaction({
        transactionHash: pendingTxn.hash,
      });

      console.log('Transaction confirmed successfully!');

      // Check if transaction was successful
      if (!txnResult.success) {
        throw new Error(`Transaction failed: ${txnResult.vm_status}`);
      }

      // Check balance after receiving
      const balanceAfter = await this.checkUSDCBalance(accountAddress);
      const receivedAmount = (BigInt(balanceAfter) - BigInt(balanceBefore)).toString();

      // console.log('USDC balance after receiving:', balanceAfter);
      // console.log('Actual received amount:', receivedAmount);

      return {
        txHash: pendingTxn.hash,
        success: true,
        usdcAmount: receivedAmount
      };
    } catch (error) {
      console.error('❌ Aptos CCTP receive failed:', error);
      return {
        txHash: '',
        success: false,
        usdcAmount: '0'
      };
    }
  }

  /**
   * Check USDC balance (FungibleAsset standard)
   */
  async checkUSDCBalance(address: string): Promise<string> {
    try {
      // Circle USDC uses Fungible Asset standard
      const faResource = await this.aptos.getAccountResource({
        accountAddress: address,
        resourceType: `0x1::fungible_asset::FungibleStore`
      });

      const balance = (faResource.data as any)?.balance || '0';
      return balance;
    } catch (error) {
      return '0';
    }
  }
}
