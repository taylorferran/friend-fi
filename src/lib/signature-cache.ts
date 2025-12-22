/**
 * Signature Cache for Frontend
 * 
 * Caches membership signatures to avoid redundant API calls
 */

interface CachedSignature {
  signature: string;
  expiresAt: number;
  cachedAt: number;
}

const CACHE_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

class SignatureCacheClass {
  private cache = new Map<string, CachedSignature>();

  /**
   * Generate cache key
   */
  private getKey(groupId: number, walletAddress: string): string {
    return `${groupId}:${walletAddress.toLowerCase()}`;
  }

  /**
   * Get cached signature if still valid
   */
  get(groupId: number, walletAddress: string): string | null {
    const key = this.getKey(groupId, walletAddress);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired (with buffer)
    if (cached.expiresAt <= Date.now() + CACHE_BUFFER_MS) {
      this.cache.delete(key);
      return null;
    }

    console.log(`[SignatureCache] Hit for group ${groupId}, user ${walletAddress.slice(0, 10)}...`);
    return cached.signature;
  }

  /**
   * Cache a signature
   */
  set(
    groupId: number,
    walletAddress: string,
    signature: string,
    expiresAt: number
  ): void {
    const key = this.getKey(groupId, walletAddress);
    this.cache.set(key, {
      signature,
      expiresAt,
      cachedAt: Date.now(),
    });
    console.log(`[SignatureCache] Cached signature for group ${groupId}, expires in ${Math.round((expiresAt - Date.now()) / 60000)}m`);
  }

  /**
   * Invalidate cache for a user/group
   */
  invalidate(groupId: number, walletAddress: string): void {
    const key = this.getKey(groupId, walletAddress);
    this.cache.delete(key);
    console.log(`[SignatureCache] Invalidated for group ${groupId}, user ${walletAddress.slice(0, 10)}...`);
  }

  /**
   * Clear all cached signatures
   */
  clear(): void {
    this.cache.clear();
    console.log('[SignatureCache] Cleared all cached signatures');
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; entries: Array<{ groupId: string; expiresIn: number }> } {
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      groupId: key.split(':')[0],
      expiresIn: Math.round((value.expiresAt - Date.now()) / 1000),
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}

// Singleton instance
export const SignatureCache = new SignatureCacheClass();

