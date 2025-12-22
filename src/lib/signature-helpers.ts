/**
 * Signature Helpers for Backend Authentication
 * 
 * Functions for generating and managing membership signatures
 */

import { Ed25519PrivateKey } from '@aptos-labs/ts-sdk';

/**
 * Format a membership message for signing
 * Format: "{user_address}:{group_id}:{expires_timestamp}"
 */
export function formatMembershipMessage(
  userAddress: string,
  groupId: number,
  expiresAt: number
): string {
  return `${userAddress}:${groupId}:${expiresAt}`;
}

/**
 * Sign a membership attestation
 * @param privateKeyHex Backend's private key (from env)
 * @param userAddress User's wallet address
 * @param groupId Group ID
 * @param expiresAt Unix timestamp (milliseconds)
 * @returns Hex-encoded signature
 */
export function signMembershipAttestation(
  privateKeyHex: string,
  userAddress: string,
  groupId: number,
  expiresAt: number
): string {
  // Parse private key
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  
  // Format message
  const message = formatMembershipMessage(userAddress, groupId, expiresAt);
  
  // Convert to bytes
  const messageBytes = new TextEncoder().encode(message);
  
  // Sign
  const signature = privateKey.sign(messageBytes);
  
  // Return hex-encoded signature
  return Buffer.from(signature.toUint8Array()).toString('hex');
}

/**
 * Generate a membership proof with default 1-hour expiration
 */
export function generateMembershipProof(
  privateKeyHex: string,
  userAddress: string,
  groupId: number,
  ttlMinutes: number = 60
): {
  signature: string;
  expiresAt: number;
  groupId: number;
  userAddress: string;
} {
  const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);
  const signature = signMembershipAttestation(
    privateKeyHex,
    userAddress,
    groupId,
    expiresAt
  );
  
  return {
    signature,
    expiresAt,
    groupId,
    userAddress,
  };
}

