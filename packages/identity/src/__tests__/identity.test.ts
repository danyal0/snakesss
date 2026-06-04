import { describe, it, expect } from 'vitest';
import type {
  FingerprintSignals,
  NameReservation,
  NetworkContext,
  SessionRejoinRecord,
  StoredIdentityProfile,
} from '../types';
import { SESSION_REJOIN_WINDOW_MS } from '../types';
import {
  buildStoredProfile,
  computeConfidence,
  isSameUser,
} from '../confidence';
import {
  allocatePostfix,
  decisionFromConfidence,
  resolveIdentityJoin,
} from '../nameResolution';
import { buildFingerprintHash } from '../hash';

const DEVICE_A: FingerprintSignals = {
  userAgent: 'Mozilla/5.0 Chrome/120',
  platform: 'MacIntel',
  screenResolution: '1920x1080',
  timezone: 'America/New_York',
  language: 'en-US',
  webglVendorHash: 'abc123',
  audioFingerprintHash: 'def456',
};

const DEVICE_B: FingerprintSignals = {
  ...DEVICE_A,
  userAgent: 'Mozilla/5.0 Firefox/121',
  webglVendorHash: 'xyz999',
};

function network(ip = '10.0.0.1'): NetworkContext {
  return { ipHash: `hash-${ip}`, asn: 'AS123', country: 'US', region: 'NY' };
}

function reservation(
  overrides: Partial<NameReservation> = {}
): NameReservation {
  const profile = buildStoredProfile(DEVICE_A, network());
  return {
    baseName: 'alice',
    displayName: 'Alice',
    identityHash: profile.identityHash,
    scope: 'ROOM1',
    playerId: 'player-1',
    reservedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    ...overrides,
  };
}

function session(
  overrides: Partial<SessionRejoinRecord> = {}
): SessionRejoinRecord {
  const profile = buildStoredProfile(DEVICE_A, network());
  return {
    identityHash: profile.identityHash,
    roomId: 'ROOM1',
    playerId: 'player-1',
    username: 'Alice',
    displayName: 'Alice',
    lastDisconnectAt: Date.now() - 60_000,
    lastPhase: 'lobby',
    expiresAt: Date.now() + 86400000,
    ...overrides,
  };
}

describe('confidence-based identity (binary outcomes only)', () => {
  it('legit disconnect → rejoin same name', () => {
    const stored = buildStoredProfile(DEVICE_A, network());
    const conf = computeConfidence(
      DEVICE_A,
      network(),
      undefined,
      stored,
      session(),
      'ROOM1'
    );
    expect(decisionFromConfidence(conf)).toBe('same_user');

    const result = resolveIdentityJoin({
      desiredName: 'Alice',
      roomId: 'ROOM1',
      scope: 'ROOM1',
      claimsFingerprint: DEVICE_A,
      claimsNetwork: network(),
      existingReservation: reservation(),
      storedProfile: stored,
      session: session(),
      postfixCounter: null,
    });
    expect(result.decision).toBe('same_user');
    expect(result.displayName).toBe('Alice');
    expect(result.nameInUseMessage).toBeUndefined();
  });

  it('same name different device → postfix', () => {
    const stored = buildStoredProfile(DEVICE_A, network('10.0.0.1'));
    const result = resolveIdentityJoin({
      desiredName: 'Alice',
      roomId: 'ROOM1',
      scope: 'ROOM1',
      claimsFingerprint: DEVICE_B,
      claimsNetwork: network('10.0.0.99'),
      existingReservation: reservation(),
      storedProfile: null,
      session: null,
      postfixCounter: null,
    });
    expect(result.decision).toBe('not_same_user');
    expect(result.displayName).toMatch(/Alice#2/);
    expect(result.nameInUseMessage).toBe('That name is already in use.');
  });

  it('same device different user → postfix when name reserved by another identity', () => {
    const owner = buildStoredProfile(DEVICE_A, network());
    const conf = computeConfidence(
      DEVICE_A,
      network('10.0.0.99'),
      { joinToActionDelayMs: 9000, inputCadenceMs: 800 },
      owner,
      null,
      'ROOM1'
    );
    // Fingerprint still matches the device, but reservation belongs to another slot
    expect(conf.fingerprintMatch).toBeGreaterThanOrEqual(45);

    const result = resolveIdentityJoin({
      desiredName: 'Alice',
      roomId: 'ROOM1',
      scope: 'ROOM1',
      claimsFingerprint: DEVICE_A,
      claimsNetwork: network('10.0.0.99'),
      claimsBehavior: { joinToActionDelayMs: 9000, inputCadenceMs: 800 },
      existingReservation: reservation({ identityHash: owner.identityHash }),
      storedProfile: null,
      session: null,
      postfixCounter: null,
    });
    expect(result.decision).toBe('not_same_user');
    expect(result.displayName).toContain('#');
  });

  it('rapid refresh → same name', () => {
    const stored = buildStoredProfile(DEVICE_A, network());
    const freshSession = session({
      lastDisconnectAt: Date.now() - 2000,
    });
    const result = resolveIdentityJoin({
      desiredName: 'Alice',
      roomId: 'ROOM1',
      scope: 'ROOM1',
      claimsFingerprint: DEVICE_A,
      claimsNetwork: network(),
      existingReservation: reservation(),
      storedProfile: stored,
      session: freshSession,
      postfixCounter: null,
    });
    expect(result.decision).toBe('same_user');
    expect(result.displayName).toBe('Alice');
  });

  it('leaderboard impersonation attempt → postfix', () => {
    const legit = buildStoredProfile(DEVICE_A, network());
    const impostor = buildStoredProfile(DEVICE_B, network('203.0.113.5'));
    expect(legit.identityHash).not.toBe(impostor.identityHash);

    const result = resolveIdentityJoin({
      desiredName: 'TopPlayer',
      roomId: 'GLOBAL',
      scope: 'leaderboard',
      claimsFingerprint: DEVICE_B,
      claimsNetwork: network('203.0.113.5'),
      existingReservation: {
        baseName: 'topplayer',
        displayName: 'TopPlayer',
        identityHash: legit.identityHash,
        scope: 'leaderboard',
        reservedAt: Date.now(),
        expiresAt: Date.now() + 1e9,
      },
      storedProfile: null,
      session: null,
      postfixCounter: null,
    });
    expect(result.decision).toBe('not_same_user');
    expect(result.displayName).toMatch(/TopPlayer#2/);
  });

  it('multiple postfix increments', () => {
    const first = allocatePostfix('Bob', 'ROOM1', null);
    expect(first.displayName).toBe('Bob#2');
    const second = allocatePostfix('Bob', 'ROOM1', first.nextCounter);
    expect(second.displayName).toBe('Bob#3');
    const third = allocatePostfix('Bob', 'ROOM1', second.nextCounter);
    expect(third.displayName).toBe('Bob#4');
  });

  it('session rejoin window boosts confidence', () => {
    const stored = buildStoredProfile(DEVICE_A, network());
    const inside = computeConfidence(
      DEVICE_A,
      network(),
      undefined,
      stored,
      session({ lastDisconnectAt: Date.now() - 1000 }),
      'ROOM1'
    );
    const outside = computeConfidence(
      DEVICE_A,
      network(),
      undefined,
      stored,
      session({
        lastDisconnectAt: Date.now() - SESSION_REJOIN_WINDOW_MS - 1000,
      }),
      'ROOM1'
    );
    expect(inside.sessionMatch).toBeGreaterThan(outside.sessionMatch);
    expect(inside.total).toBeGreaterThanOrEqual(45);
  });

  it('fingerprint hash is stable for identical signals', () => {
    expect(buildFingerprintHash(DEVICE_A)).toBe(buildFingerprintHash(DEVICE_A));
    expect(buildFingerprintHash(DEVICE_A)).not.toBe(buildFingerprintHash(DEVICE_B));
  });

  it('binary decision is always same_user or not_same_user', () => {
    const result = resolveIdentityJoin({
      desiredName: 'Alice',
      roomId: 'ROOM1',
      scope: 'ROOM1',
      claimsFingerprint: DEVICE_A,
      claimsNetwork: network(),
      existingReservation: null,
      storedProfile: null,
      session: null,
      postfixCounter: null,
    });
    expect(['same_user', 'not_same_user']).toContain(result.decision);
  });
});
