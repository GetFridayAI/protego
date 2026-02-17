import * as crypto from 'crypto';

/**
 * Generate a 64-character hex string (256 bits / 32 bytes)
 * @returns 64-character hex string
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate if a string is a valid session token (64-character hex)
 */
export function isValidSessionToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}
