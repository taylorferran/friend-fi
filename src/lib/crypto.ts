import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * Hash a password using SHA-256
 * This is done client-side before sending to Supabase
 * 
 * Note: For production, consider using a proper password hashing library
 * like bcrypt or argon2, but for hackathon purposes SHA-256 is sufficient
 */
export function hashPassword(password: string): string {
  const passwordBytes = new TextEncoder().encode(password);
  const hashBytes = sha256(passwordBytes);
  return bytesToHex(hashBytes);
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Generate a random salt for additional security (optional)
 */
export function generateSalt(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return bytesToHex(randomBytes);
}

/**
 * Hash password with salt
 */
export function hashPasswordWithSalt(password: string, salt: string): string {
  const combined = password + salt;
  return hashPassword(combined);
}

