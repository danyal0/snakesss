import type {
  BehavioralSignals,
  ConfidenceScoreInternal,
  FingerprintSignals,
  NetworkContext,
  SessionRejoinRecord,
  StoredIdentityProfile,
} from './types';
import { SESSION_REJOIN_WINDOW_MS } from './types';
import { buildFingerprintHash, hashComponentSignals, hashWithSalt } from './hash';

/** Network only boosts confidence — floor at 40 when fingerprint is strong. */
function scoreNetworkMatch(
  incoming: NetworkContext,
  stored: NetworkContext,
  fingerprintScore: number
): number {
  let score = 0;
  if (incoming.ipHash === stored.ipHash) score += 50;
  if (incoming.asn && stored.asn && incoming.asn === stored.asn) score += 25;
  if (incoming.country && stored.country && incoming.country === stored.country) {
    score += 15;
  }
  if (
    incoming.region &&
    stored.region &&
    incoming.region === stored.region
  ) {
    score += 10;
  }

  if (fingerprintScore >= 70 && score < 40) return 40;
  return Math.min(100, score);
}

function scoreFingerprintMatch(
  incoming: FingerprintSignals,
  stored: StoredIdentityProfile
): number {
  const incomingHash = buildFingerprintHash(incoming);
  if (incomingHash === stored.fingerprintHash) return 100;

  const incomingComponents = hashComponentSignals(incoming);
  const keys = Object.keys(incomingComponents) as (keyof FingerprintSignals)[];
  let matches = 0;
  for (const key of keys) {
    if (incomingComponents[key] === stored.componentHashes[key]) matches++;
  }

  const ratio = matches / keys.length;
  if (ratio >= 0.85) return 90;
  if (ratio >= 0.6) return 70;
  if (ratio >= 0.4) return 45;
  if (ratio >= 0.25) return 25;
  return Math.round(ratio * 40);
}

function scoreSessionMatch(
  session: SessionRejoinRecord | null,
  roomId: string,
  now: number
): number {
  if (!session) return 0;
  if (session.roomId !== roomId) return 10;

  const elapsed = now - session.lastDisconnectAt;
  if (elapsed > SESSION_REJOIN_WINDOW_MS) {
    const decay = Math.max(0, 30 - Math.floor(elapsed / (60 * 60 * 1000)));
    return decay;
  }

  const freshness = 1 - elapsed / SESSION_REJOIN_WINDOW_MS;
  return Math.round(60 + freshness * 40);
}

function scoreBehaviorMatch(
  incoming?: BehavioralSignals,
  stored?: BehavioralSignals
): number {
  if (!incoming || !stored) return 50;

  let score = 50;
  if (
    incoming.joinToActionDelayMs !== undefined &&
    stored.joinToActionDelayMs !== undefined
  ) {
    const diff = Math.abs(
      incoming.joinToActionDelayMs - stored.joinToActionDelayMs
    );
    if (diff < 500) score += 25;
    else if (diff < 2000) score += 15;
  }
  if (
    incoming.inputCadenceMs !== undefined &&
    stored.inputCadenceMs !== undefined
  ) {
    const diff = Math.abs(incoming.inputCadenceMs - stored.inputCadenceMs);
    if (diff < 100) score += 15;
    else if (diff < 400) score += 8;
  }
  if (
    incoming.interactionRhythm !== undefined &&
    stored.interactionRhythm !== undefined
  ) {
    const diff = Math.abs(
      incoming.interactionRhythm - stored.interactionRhythm
    );
    if (diff < 0.15) score += 10;
  }
  return Math.min(100, score);
}

export function computeConfidence(
  incomingFingerprint: FingerprintSignals,
  incomingNetwork: NetworkContext,
  incomingBehavior: BehavioralSignals | undefined,
  stored: StoredIdentityProfile | null,
  session: SessionRejoinRecord | null,
  roomId: string,
  now = Date.now()
): ConfidenceScoreInternal {
  const fingerprintMatch = stored
    ? scoreFingerprintMatch(incomingFingerprint, stored)
    : 0;

  const networkMatch = stored
    ? scoreNetworkMatch(incomingNetwork, stored.networkContext, fingerprintMatch)
    : incomingNetwork.ipHash
      ? 30
      : 0;

  const sessionMatch = scoreSessionMatch(session, roomId, now);

  const behaviorMatch = scoreBehaviorMatch(
    incomingBehavior,
    stored?.behavioral
  );

  const total = Math.round(
    fingerprintMatch * 0.45 +
      networkMatch * 0.2 +
      sessionMatch * 0.25 +
      behaviorMatch * 0.1
  );

  return {
    fingerprintMatch,
    networkMatch,
    sessionMatch,
    behaviorMatch,
    total: Math.min(100, Math.max(0, total)),
    computedAt: now,
  };
}

export function isSameUser(confidence: ConfidenceScoreInternal): boolean {
  return confidence.total >= 45;
}

export function buildStoredProfile(
  fingerprint: FingerprintSignals,
  network: NetworkContext,
  behavioral?: BehavioralSignals
): StoredIdentityProfile {
  const fingerprintHash = buildFingerprintHash(fingerprint);
  const componentHashes = hashComponentSignals(fingerprint);
  return {
    identityHash: fingerprintHash,
    fingerprintHash,
    componentHashes,
    networkContext: network,
    behavioral,
    lastSeenAt: Date.now(),
  };
}
