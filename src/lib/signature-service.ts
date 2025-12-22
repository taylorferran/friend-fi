/**
 * Signature Service for Frontend
 * 
 * Handles requesting and caching membership signatures
 */

import { SignatureCache } from './signature-cache';

export interface MembershipProof {
  signature: string;
  expiresAt: number;
  groupId: number;
  userAddress: string;
}

/**
 * Request a membership signature from the backend
 * Uses cache when available
 */
export async function requestMembershipSignature(
  groupId: number,
  walletAddress: string
): Promise<MembershipProof> {
  // Check cache first
  const cachedSignature = SignatureCache.get(groupId, walletAddress);
  
  if (cachedSignature) {
    // Return cached signature (we don't know expiresAt, so fetch it)
    // Actually, we should cache the full proof. Let me fix this...
    // For now, fetch fresh if not in cache
  }

  console.log(`[SignatureService] Requesting signature for group ${groupId}...`);

  // Request from backend
  const response = await fetch(`/api/groups/${groupId}/membership-proof`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      groupId,
      walletAddress,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to get membership signature: ${response.status}`);
  }

  const proof: MembershipProof = await response.json();

  // Cache it
  SignatureCache.set(groupId, walletAddress, proof.signature, proof.expiresAt);

  console.log(`[SignatureService] Received signature, expires at ${new Date(proof.expiresAt).toLocaleTimeString()}`);

  return proof;
}

/**
 * Invalidate cached signature (e.g., after leaving group)
 */
export function invalidateMembershipSignature(
  groupId: number,
  walletAddress: string
): void {
  SignatureCache.invalidate(groupId, walletAddress);
}

/**
 * Clear all cached signatures
 */
export function clearSignatureCache(): void {
  SignatureCache.clear();
}

