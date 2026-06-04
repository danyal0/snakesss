import { createHash } from 'crypto';
import type { FingerprintSignals } from './types';

const DEFAULT_SALT =
  process.env['IDENTITY_HASH_SALT'] ?? 'snakesss-identity-v1';

export function hashWithSalt(value: string, salt = DEFAULT_SALT): string {
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

export function hashIp(rawIp: string, salt = DEFAULT_SALT): string {
  return hashWithSalt(`ip:${rawIp}`, salt);
}

/** Build a stable identity hash from salted component hashes. */
export function buildFingerprintHash(
  signals: FingerprintSignals,
  salt = DEFAULT_SALT
): string {
  const parts = [
    signals.userAgent,
    signals.platform,
    signals.screenResolution,
    signals.timezone,
    signals.language,
    signals.webglVendorHash,
    signals.audioFingerprintHash,
  ].map((p) => hashWithSalt(p, salt));

  return hashWithSalt(parts.join('|'), salt);
}

export function hashComponentSignals(
  signals: FingerprintSignals,
  salt = DEFAULT_SALT
): Record<keyof FingerprintSignals, string> {
  return {
    userAgent: hashWithSalt(signals.userAgent, salt),
    platform: hashWithSalt(signals.platform, salt),
    screenResolution: hashWithSalt(signals.screenResolution, salt),
    timezone: hashWithSalt(signals.timezone, salt),
    language: hashWithSalt(signals.language, salt),
    webglVendorHash: hashWithSalt(signals.webglVendorHash, salt),
    audioFingerprintHash: hashWithSalt(signals.audioFingerprintHash, salt),
  };
}

export function normalizeBaseName(name: string): string {
  return name.replace(/#\d+$/, '').trim().toLowerCase();
}

export function stripPostfix(displayName: string): string {
  return displayName.replace(/#\d+$/, '').trim();
}
