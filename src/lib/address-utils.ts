/**
 * Address utility functions for converting between Ethereum and Aptos address formats
 * Privy returns Ethereum-style addresses (40 hex chars), but Aptos needs 64 hex chars
 */

import { sha3_256 } from '@noble/hashes/sha3.js';

/**
 * Derive Aptos address from Ed25519 public key
 * This is the actual address used by the signer in transactions
 * Aptos addresses are derived by: SHA3-256(public_key_bytes || 0x00)
 * 
 * @param publicKeyHex - Ed25519 public key in hex format (with or without 0x prefix)
 * @returns Aptos address (64 hex chars with 0x prefix)
 */
export function deriveAptosAddressFromPublicKey(publicKeyHex: string): string {
  // Remove 0x prefix if present
  const pubKeyBytes = publicKeyHex.startsWith('0x') 
    ? publicKeyHex.slice(2) 
    : publicKeyHex;
  
  // Convert hex string to Uint8Array
  const pubKeyArray = new Uint8Array(
    pubKeyBytes.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
  
  // Append 0x00 byte as per Aptos specification
  const input = new Uint8Array(pubKeyArray.length + 1);
  input.set(pubKeyArray, 0);
  input[pubKeyArray.length] = 0x00;
  
  // Compute SHA3-256 hash
  const hash = sha3_256(input);
  
  // Convert hash to hex string with 0x prefix
  const address = '0x' + Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return address;
}

/**
 * Pad an address to Aptos format (64 hex characters, excluding 0x)
 * NOTE: This is NOT the same as the actual Aptos address derived from public key!
 * Use deriveAptosAddressFromPublicKey() when you have the public key.
 * @param address - Address in any format (Ethereum 40 chars or Aptos 64 chars)
 * @returns Address padded to 64 hex characters
 */
export function padAddressToAptos(address: string): string {
  if (!address) return address;
  
  // Remove 0x prefix if present
  const withoutPrefix = address.startsWith('0x') ? address.slice(2) : address;
  
  // Pad to 64 hex characters (Aptos format)
  const padded = withoutPrefix.padStart(64, '0');
  
  // Return with 0x prefix
  return `0x${padded}`;
}

/**
 * Normalize address for Aptos - ensures it's in the correct format
 * @param address - Address in any format
 * @returns Normalized Aptos address (64 hex chars with 0x prefix)
 */
export function normalizeAptosAddress(address: string): string {
  return padAddressToAptos(address);
}

