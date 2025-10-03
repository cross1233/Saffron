#!/usr/bin/env ts-node

import { ethers } from 'ethers';
import { BaseCCTPSender } from '../src/base-sender';
import { CircleAttestationService } from '../src/circle-attestation';
import { AptosCCTPReceiver } from '../src/aptos-receiver';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const CONFIG = {
  BASE_PRIVATE_KEY: process.env.BASE_PRIVATE_KEY || '',
  BASE_RPC_URL: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
  APTOS_PRIVATE_KEY: process.env.APTOS_PRIVATE_KEY || '',
  APTOS_RECIPIENT: process.env.APTOS_RECIPIENT || '',
};

const USDC_AMOUNT = '3.0';

function validateConfig() {
  const errors: string[] = [];

  if (!CONFIG.BASE_PRIVATE_KEY) {
    errors.push('❌ Missing BASE_PRIVATE_KEY environment variable');
  }

  if (!CONFIG.APTOS_PRIVATE_KEY) {
    errors.push('❌ Missing APTOS_PRIVATE_KEY environment variable');
  }

  if (!CONFIG.APTOS_RECIPIENT) {
    errors.push('❌ Missing APTOS_RECIPIENT environment variable');
  }

  if (errors.length > 0) {
    console.error('\nConfiguration errors:\n');
    errors.forEach(err => console.error(err));
    console.error('\nPlease configure as follows:\n');
    console.error('1. Copy .env.example to .env:');
    console.error('   cp .env.example .env\n');
    console.error('2. Edit .env file, fill in your private keys and addresses\n');
    console.error('3. Run the test script again\n');
    process.exit(1);
  }
}

async function main() {
  validateConfig();

  console.log('🚀 Base -> Aptos CCTP cross-chain test started\n');
  console.log('='.repeat(60));

  try {
    console.log('\n📋 Step 1/4: Initializing services...');

    const baseProvider = new ethers.JsonRpcProvider(CONFIG.BASE_RPC_URL);
    const baseSigner = new ethers.Wallet(CONFIG.BASE_PRIVATE_KEY, baseProvider);
    const baseAddress = await baseSigner.getAddress();

    const baseSender = new BaseCCTPSender();
    const attestationService = new CircleAttestationService();
    const aptosReceiver = new AptosCCTPReceiver();

    console.log('✅ Services initialization completed');
    console.log(`  Base chain address: ${baseAddress}`);
    console.log(`  Aptos recipient address: ${CONFIG.APTOS_RECIPIENT}`);
    console.log(`  Cross-chain amount: ${USDC_AMOUNT} USDC`);

    console.log('\n💸 Step 2/4: Burning USDC on Base chain...');

    const balance = await baseSender.checkUSDCBalance(baseAddress);
    console.log(`  Current USDC balance: ${balance}`);

    if (parseFloat(balance) < parseFloat(USDC_AMOUNT)) {
      throw new Error(`Insufficient balance! Need ${USDC_AMOUNT} USDC, currently have ${balance} USDC`);
    }

    const sendResult = await baseSender.executeFullCrossChain({
      amount: USDC_AMOUNT,
      recipientAddress: CONFIG.APTOS_RECIPIENT,
      signer: baseSigner,
    });

    console.log('✅ Base chain transaction successful');
    console.log(`  Transaction hash: ${sendResult.txHash}`);
    console.log(`  Nonce: ${sendResult.nonce}`);
    console.log(`  Message length: ${sendResult.messageBytes?.length || 0} characters`);

    console.log('\n🔐 Step 3/4: Waiting for Circle signature...');
    console.log('  ⏳ This usually takes 1-3 minutes, please be patient...');

    const attestationData = await attestationService.getAttestationFromTransaction(
      sendResult.txHash,
      baseProvider
    );

    console.log('✅ Circle signature obtained successfully');
    console.log(`  Message hash: ${attestationData.messageHash}`);
    console.log(`  Message length: ${attestationData.messageBytes.length}`);
    console.log(`  Signature length: ${attestationData.attestation.length}`);

    console.log('\n🎁 Step 4/4: Receiving USDC on Aptos chain...');

    const balanceBefore = await aptosReceiver.checkUSDCBalance(CONFIG.APTOS_RECIPIENT);
    console.log(`  Balance before receiving: ${balanceBefore}`);

    const receiveResult = await aptosReceiver.receiveCCTPUSDC({
      messageBytes: attestationData.messageBytes,
      attestation: attestationData.attestation,
      recipientPrivateKey: CONFIG.APTOS_PRIVATE_KEY,
    });

    if (receiveResult.success) {
      console.log('✅ Aptos chain receive successful');
      console.log(`  Transaction hash: ${receiveResult.txHash}`);
      console.log(`  Received amount: ${receiveResult.usdcAmount}`);
      const balanceAfter = await aptosReceiver.checkUSDCBalance(CONFIG.APTOS_RECIPIENT);
      console.log(`  Balance after receiving: ${balanceAfter}`);
    } else {
      throw new Error('Aptos chain receive failed');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
