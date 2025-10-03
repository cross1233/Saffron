import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  MoveVector
} from '@aptos-labs/ts-sdk';
import * as fs from 'fs';
import * as path from 'path';

const APTOS_TESTNET_CONFIG = {
  network: Network.TESTNET,
  rpcUrl: "https://fullnode.testnet.aptoslabs.com",
  domainId: 9,
  packages: {
    messageTransmitter: "0x081e86cebf457a0c6004f35bd648a2794698f52e0dde09a48619dcd3d4cc23d9",
    tokenMessengerMinter: "0x5f9b937419dda90aa06c1836b7847f65bbbe3f1217567758dc2488be31a477b9"
  },
  objects: {
    messageTransmitter: "0xcbb70e4f5d89b4a37e850c22d7c994e32c31e9cf693e9633784e482e9a879e0c",
    tokenMessengerMinter: "0x1fbf4458a00a842a4774f441fac7a41f2da0488dd93a43880e76d58789144e17",
    usdc: "0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832"
  }
};

export interface AptosReceiveParams {
  messageBytes: string;
  attestation: string;
  recipientPrivateKey?: string;
}

export interface AptosReceiveResult {
  txHash: string;
  success: boolean;
  usdcAmount?: string;
}

export class AptosCCTPReceiver {
  private aptos: Aptos;
  private config: AptosConfig;

  constructor() {
    this.config = new AptosConfig({
      network: APTOS_TESTNET_CONFIG.network
    });
    this.aptos = new Aptos(this.config);
  }

  private validateMessageBytes(messageBytes: string): boolean {
    if (!messageBytes || typeof messageBytes !== 'string') {
      console.log('Message bytes is empty or not a string:', messageBytes);
      return false;
    }
    
    const isValid = messageBytes.startsWith('0x') && messageBytes.length > 10;
    console.log('Message bytes validation:', {
      messageBytes: messageBytes.substring(0, 50) + '...',
      length: messageBytes.length,
      startsWithOx: messageBytes.startsWith('0x'),
      isValid
    });
    
    return isValid;
  }

  private validateAttestation(attestation: string): boolean {
    return attestation.startsWith('0x') && attestation.length > 10;
  }

  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.replace('0x', '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  async checkUSDCBalance(address: string): Promise<string> {
    try {
      console.log('Checking Aptos USDC balance...', address);

      try {
        const faResource = await this.aptos.getAccountResource({
          accountAddress: address,
          resourceType: `0x1::fungible_asset::FungibleStore`
        });

        const balance = (faResource.data as any)?.balance || '0';
        console.log('USDC balance query successful (Fungible Asset):', balance);
        return balance;

      } catch (faError) {
        console.log('Trying traditional Coin standard query...');
        const coinResource = await this.aptos.getAccountResource({
          accountAddress: address,
          resourceType: `0x1::coin::CoinStore<${APTOS_TESTNET_CONFIG.objects.usdc}::coin::USDC>`
        });

        const balance = (coinResource.data as any)?.coin?.value || '0';
        console.log('USDC balance query successful (Coin):', balance);
        return balance;
      }

    } catch (error) {
      console.log('USDC balance query failed (account may not exist or not initialized):', (error as Error).message);
      return '0';
    }
  }

  async receiveCCTPUSDC(params: AptosReceiveParams): Promise<AptosReceiveResult> {
    try {
      console.log('Starting Aptos CCTP receive...');

      if (!this.validateMessageBytes(params.messageBytes)) {
        throw new Error('Invalid message bytes format');
      }

      if (!this.validateAttestation(params.attestation)) {
        throw new Error('Invalid attestation format');
      }

      if (!params.recipientPrivateKey) {
        throw new Error('Recipient private key required for signing');
      }

      const privateKey = new Ed25519PrivateKey(params.recipientPrivateKey);
      const account = Account.fromPrivateKey({ privateKey });
      const accountAddress = account.accountAddress.toString();

      console.log('Receiver account address:', accountAddress);

      const balanceBefore = await this.checkUSDCBalance(accountAddress);

      const messageBytesArray = Array.from(this.hexToBytes(params.messageBytes));
      const attestationArray = Array.from(this.hexToBytes(params.attestation));

      const scriptPath = path.join(__dirname, '../scripts/cctp/handle_receive_message.mv');

      const bytecode = Uint8Array.from(fs.readFileSync(scriptPath));

      const functionArguments: Array<any> = [
        MoveVector.U8(Buffer.from(this.hexToBytes(params.messageBytes))),
        MoveVector.U8(Buffer.from(this.hexToBytes(params.attestation)))
      ];

      const transaction = await this.aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          bytecode,
          functionArguments,
        },
      });

      console.log('Transaction built, starting signature and submission...');

      const pendingTxn = await this.aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      console.log('Transaction submitted, waiting for confirmation...', pendingTxn.hash);

      const txnResult = await this.aptos.waitForTransaction({
        transactionHash: pendingTxn.hash,
      });

      console.log('Transaction confirmed successfully!');

      if (!txnResult.success) {
        throw new Error(`Transaction failed: ${txnResult.vm_status}`);
      }

      const balanceAfter = await this.checkUSDCBalance(accountAddress);
      const receivedAmount = (BigInt(balanceAfter) - BigInt(balanceBefore)).toString();

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


  async isMessageProcessed(messageHash: string): Promise<boolean> {
    try {
      const result = await this.aptos.view({
        payload: {
          function: `${APTOS_TESTNET_CONFIG.packages.messageTransmitter}::message_transmitter::is_nonce_used`,
          functionArguments: [messageHash]
        }
      });

      return result[0] as boolean;

    } catch (error) {
      console.error('Failed to check message status:', error);
      return false;
    }
  }

  async getAccountInfo(address: string) {
    try {
      const account = await this.aptos.getAccountInfo({
        accountAddress: address
      });
      return account;
    } catch (error) {
      console.error('Failed to get account info:', error);
      return null;
    }
  }

  createTestAccount(): Account {
    const account = Account.generate();
    console.log('Created test account:', {
      address: account.accountAddress.toString(),
      privateKey: account.privateKey.toString(),
      publicKey: account.publicKey.toString()
    });
    return account;
  }
}

export const aptosCCTPReceiver = new AptosCCTPReceiver();

export { APTOS_TESTNET_CONFIG };