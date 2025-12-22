#!/usr/bin/env tsx
/**
 * Generate Backend Keypair for Signature-Based Authentication
 * 
 * This script generates an Ed25519 keypair for the backend to use
 * when signing membership attestations.
 * 
 * Usage: npx tsx scripts/generate-backend-keypair.ts
 */

import { Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

console.log('🔐 Generating Backend Keypair for Signature Authentication\n');
console.log('━'.repeat(70));

// Generate new keypair
const privateKey = Ed25519PrivateKey.generate();
const publicKey = privateKey.publicKey();

// Get hex representations
const privateKeyHex = privateKey.toString();
const publicKeyHex = publicKey.toString();
const publicKeyBytes = publicKey.toUint8Array();

console.log('\n📝 PRIVATE KEY (⚠️  KEEP SECRET!)');
console.log('━'.repeat(70));
console.log('Add this to your .env.local file:');
console.log(`\nBACKEND_SIGNER_PRIVATE_KEY=${privateKeyHex}\n`);

console.log('\n📝 PUBLIC KEY (embed in Move contract)');
console.log('━'.repeat(70));
console.log('Hex format:');
console.log(publicKeyHex);
console.log('\nMove vector format:');
console.log(`const BACKEND_PUBLIC_KEY: vector<u8> = x"${publicKeyHex.slice(2)}";`);
console.log('\nBytes array format:');
console.log(`[${Array.from(publicKeyBytes).join(', ')}]`);

console.log('\n⚠️  SECURITY NOTES');
console.log('━'.repeat(70));
console.log('1. NEVER commit the private key to git');
console.log('2. Add .env.local to .gitignore');
console.log('3. Store private key securely (use secrets manager in production)');
console.log('4. Rotate keys periodically');
console.log('5. The public key can be shared (it goes in the smart contract)');

console.log('\n✅ Done! Save these values before closing this terminal.\n');

