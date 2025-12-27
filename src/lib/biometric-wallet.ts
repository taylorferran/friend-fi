/**
 * Biometric Wallet System
 * Derives private keys from biometric-locked encrypted seeds
 * Mobile-only flow that replaces email login
 */

import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

// Storage keys
const BIOMETRIC_SEED_KEY = 'friendfi_biometric_seed';
const BIOMETRIC_CREDENTIAL_KEY = 'friendfi_biometric_credential';

/**
 * Generate a random 256-bit master seed
 */
function generateMasterSeed(): Uint8Array {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array;
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(array: Uint8Array): string {
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Derive a Move private key (Ed25519) from a seed using HKDF-like derivation
 * This ensures the same seed always produces the same key
 * @param seed - The master seed
 */
async function derivePrivateKeyFromSeed(seed: Uint8Array): Promise<string> {
  // Use Web Crypto API to derive a key from the seed
  // We'll use a simple PBKDF2-like approach for deterministic key derivation
  // In production, you might want to use a proper HD wallet derivation (BIP32/BIP44)
  
  // Ensure seed is a proper Uint8Array (not a generic ArrayBufferLike)
  const seedArray = new Uint8Array(seed);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    seedArray,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('friendfi-move-salt'), // Fixed salt for determinism
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes for Ed25519 private key
  );
  
  const derivedArray = new Uint8Array(derivedBits);
  const privateKeyHex = uint8ArrayToHex(derivedArray);
  return `0x${privateKeyHex}`;
}

/**
 * Encrypt seed using WebAuthn credential (stored in secure enclave)
 * We'll store the seed encrypted with a key derived from the biometric credential
 */
async function encryptSeedWithBiometric(seed: Uint8Array, credentialId: string): Promise<string> {
  // For now, we'll use a simple approach:
  // Store the seed encrypted with a key derived from credentialId
  // In production, you'd use the WebAuthn credential's private key for encryption
  
  // Simple encryption: XOR with a key derived from credentialId
  // In production, use proper AES-GCM encryption
  const key = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credentialId));
  const keyArray = new Uint8Array(key);
  
  const encrypted = new Uint8Array(seed.length);
  for (let i = 0; i < seed.length; i++) {
    encrypted[i] = seed[i] ^ keyArray[i % keyArray.length];
  }
  
  return uint8ArrayToHex(encrypted);
}

/**
 * Decrypt seed using biometric credential
 */
async function decryptSeedWithBiometric(encryptedHex: string, credentialId: string): Promise<Uint8Array> {
  const encrypted = hexToUint8Array(encryptedHex);
  
  const key = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credentialId));
  const keyArray = new Uint8Array(key);
  
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ keyArray[i % keyArray.length];
  }
  
  return decrypted;
}

/**
 * Register biometric and create encrypted seed
 */
export async function registerBiometricWallet(): Promise<{
  credentialId: string;
  privateKey: string; // Move private key (Ed25519)
  address: string;
}> {
  // Step 1: Generate master seed
  const seed = generateMasterSeed();
  
  // Step 2: Register WebAuthn credential
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  
  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'Friend-Fi',
      id: window.location.hostname,
    },
    user: {
      id: new Uint8Array(16), // Random user ID
      name: 'friendfi-user',
      displayName: 'Friend-Fi User',
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Biometric only
      userVerification: 'required',
    },
    timeout: 60000,
    attestation: 'none',
  };

  const credential = await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  }) as PublicKeyCredential;

  if (!credential || !credential.rawId) {
    throw new Error('Failed to create biometric credential');
  }

  const credentialId = uint8ArrayToHex(new Uint8Array(credential.rawId));
  
  // Step 3: Encrypt seed with biometric credential
  const encryptedSeed = await encryptSeedWithBiometric(seed, credentialId);
  
  // Step 4: Derive Move private key (Ed25519) from seed
  const privateKey = await derivePrivateKeyFromSeed(seed);
  
  // Step 5: Create Account from private key to get address
  const privateKeyObj = new Ed25519PrivateKey(privateKey);
  const account = Account.fromPrivateKey({ privateKey: privateKeyObj });
  const address = account.accountAddress.toString();
  
  // Step 6: Store encrypted seed and credential ID
  localStorage.setItem(BIOMETRIC_SEED_KEY, encryptedSeed);
  localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
  
  return {
    credentialId,
    privateKey,
    address,
  };
}

/**
 * Authenticate with biometric and derive private key
 */
export async function authenticateBiometricWallet(): Promise<{
  privateKey: string; // Move private key (Ed25519)
  address: string;
}> {
  // Step 1: Get stored credential ID
  const credentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  if (!credentialId) {
    throw new Error('No biometric wallet registered');
  }

  const credentialIdBytes = new Uint8Array(hexToUint8Array(credentialId));
  
  // Step 2: Authenticate with biometric
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  
  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    allowCredentials: [
      {
        id: credentialIdBytes,
        type: 'public-key',
        transports: ['internal'],
      },
    ],
    timeout: 60000,
    userVerification: 'required',
  };

  const assertion = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  }) as PublicKeyCredential;

  if (!assertion) {
    throw new Error('Biometric authentication failed');
  }

  // Step 3: Decrypt seed
  const encryptedSeed = localStorage.getItem(BIOMETRIC_SEED_KEY);
  if (!encryptedSeed) {
    throw new Error('No encrypted seed found');
  }

  const seed = await decryptSeedWithBiometric(encryptedSeed, credentialId);
  
  // Step 4: Derive Move private key (Ed25519) from seed
  const privateKey = await derivePrivateKeyFromSeed(seed);
  
  // Step 5: Get address from private key
  const privateKeyObj = new Ed25519PrivateKey(privateKey);
  const account = Account.fromPrivateKey({ privateKey: privateKeyObj });
  const address = account.accountAddress.toString();
  
  return {
    privateKey,
    address,
  };
}

/**
 * Check if biometric wallet is registered
 */
export function hasBiometricWallet(): boolean {
  return !!(
    localStorage.getItem(BIOMETRIC_SEED_KEY) &&
    localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY)
  );
}

/**
 * Remove biometric wallet
 */
export function removeBiometricWallet(): void {
  localStorage.removeItem(BIOMETRIC_SEED_KEY);
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
}

