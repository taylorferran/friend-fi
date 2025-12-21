/**
 * Address utility functions for converting between Ethereum and Aptos address formats
 * Privy returns Ethereum-style addresses (40 hex chars), but Aptos needs 64 hex chars
 */

/**
 * Derive Aptos address from Ed25519 public key
 * This is the actual address used by the signer in transactions
 * Aptos addresses are derived by: SHA3-256(public_key_bytes || 0x00)
 * 
 * NOTE: This requires @noble/hashes which may not be available.
 * For now, this function will throw an error. Use padAddressToAptos() as a fallback.
 * 
 * @param publicKeyHex - Ed25519 public key in hex format (with or without 0x prefix)
 * @returns Aptos address (64 hex chars with 0x prefix)
 */
export async function deriveAptosAddressFromPublicKey(publicKeyHex: string): Promise<string> {
  // TODO: Implement proper address derivation from Ed25519 public key
  // This requires SHA3-256 which needs @noble/hashes
  // For now, throw an error so callers know to use the fallback
  throw new Error('deriveAptosAddressFromPublicKey not yet implemented - use padded address for now');
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

