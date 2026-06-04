import type { IdentityClaims } from '@snakesss/shared-types';
import { buildFingerprintHash } from '@snakesss/identity';

/** Minimal claims when client omits identity (mobile, legacy). */
export function fallbackIdentityClaims(socketId: string): IdentityClaims {
  const fingerprint = {
    userAgent: 'unknown',
    platform: 'unknown',
    screenResolution: '0x0',
    timezone: 'UTC',
    language: 'en',
    webglVendorHash: socketId.slice(0, 16),
    audioFingerprintHash: socketId.slice(16, 32) || socketId,
  };
  void buildFingerprintHash(fingerprint);
  return { fingerprint, clientTimestamp: Date.now() };
}
