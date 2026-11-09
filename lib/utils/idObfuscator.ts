import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.PARCEL_ID_SECRET || '';
const KEY = crypto.createHash('sha256').update(SECRET_KEY).digest();
const IV = crypto.createHash('md5').update('nhadat_fixed_iv').digest(); // 16 bytes constant

/**
 * Obfuscates a parcel WFS ID (e.g. ranhthua.13506182) to a URL-safe Base64 cipher text.
 * If the input is already a UUID or doesn't match WFS format, it is returned as-is.
 */
export function obfuscateParcelId(id: string): string {
  if (!id) return '';
  // Only obfuscate WFS IDs (e.g. contains a dot like ranhthua.123 or consists only of digits)
  if (!id.includes('.') && !/^\d+$/.test(id)) {
    return id;
  }
  
  try {
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
    let encrypted = cipher.update(id, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Convert to URL-safe base64
    return encrypted.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (err) {
    return id;
  }
}

/**
 * Deobfuscates a URL-safe Base64 cipher text back to the WFS ID.
 * If decryption fails (e.g. it is a standard UUID or mongo ID), the input is returned as-is.
 */
export function deobfuscateParcelId(obfuscatedId: string): string {
  if (!obfuscatedId) return '';
  
  // If it already contains a dot, it is already a raw WFS ID
  if (obfuscatedId.includes('.')) {
    return obfuscatedId;
  }
  
  try {
    // Restore standard base64 padding and characters
    let base64 = obfuscatedId.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      base64 += '='.repeat(4 - pad);
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
    let decrypted = decipher.update(base64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails (which is expected for standard UUIDs or custom IDs), return as-is
    return obfuscatedId;
  }
}
