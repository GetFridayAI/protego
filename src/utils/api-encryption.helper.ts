/**
 * Client-side encryption utility for API requests
 * This file demonstrates how to encrypt payloads before sending to the Protego API
 */

import * as crypto from 'crypto';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export class ApiEncryptionHelper {
  private encryptionKey: Buffer;
  private algorithm: string;

  constructor(encryptionKeyHex: string, algorithm: string = 'aes-256-gcm') {
    if (encryptionKeyHex.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long');
    }

    // Convert hex string to buffer
    this.encryptionKey =
      Buffer.from(encryptionKeyHex, 'hex').length === 32
        ? Buffer.from(encryptionKeyHex, 'hex')
        : Buffer.from(encryptionKeyHex.padEnd(32, '0').substring(0, 32));

    this.algorithm = algorithm;
  }

  /**
   * Encrypt a payload object
   * @param payload The data to encrypt
   * @returns Encrypted payload with ciphertext, iv, and authTag
   */
  encrypt(payload: any): EncryptedPayload {
    const payloadString = JSON.stringify(payload);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );

    let encrypted = cipher.update(payloadString, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt an encrypted payload (for testing/verification)
   * @param encryptedPayload The encrypted data
   * @returns Decrypted payload as object
   */
  decrypt(encryptedPayload: EncryptedPayload): any {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(encryptedPayload.iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(encryptedPayload.authTag, 'hex'));

    let decrypted = decipher.update(encryptedPayload.ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return JSON.parse(decrypted);
  }
}

/**
 * Example: Using the helper
 */
export function example() {
  const helper = new ApiEncryptionHelper(
    '0123456789abcdef0123456789abcdef',
  );

  // Payload to encrypt
  const loginPayload = {
    email: 'user@example.com',
    password: 'secure-password-123',
  };

  // Encrypt
  const encrypted = helper.encrypt(loginPayload);

  console.log('Encrypted payload:', encrypted);

  // Send via HTTP (example)
  // fetch('http://localhost:3000/api/auth/login', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'X-API-Key': 'your-64-char-api-key'
  //   },
  //   body: JSON.stringify(encrypted)
  // });

  // For testing, decrypt locally
  const decrypted = helper.decrypt(encrypted);
  console.log('Decrypted payload:', decrypted);
  // Output: { email: 'user@example.com', password: 'secure-password-123' }
}
