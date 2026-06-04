import type {
  BehavioralSignals,
  ConfidenceScoreInternal,
  FingerprintSignals,
  IdentityDecision,
  IdentityJoinResult,
  NameReservation,
  NetworkContext,
  PostfixCounter,
  SessionRejoinRecord,
  StoredIdentityProfile,
} from './types';
import { CONFIDENCE_THRESHOLD } from './types';
import { normalizeBaseName, stripPostfix } from './hash';
import {
  buildStoredProfile,
  computeConfidence,
  isSameUser,
} from './confidence';

export interface ResolveNameInput {
  desiredName: string;
  roomId: string;
  scope: string;
  claimsFingerprint: FingerprintSignals;
  claimsNetwork: NetworkContext;
  claimsBehavior?: BehavioralSignals;
  existingReservation: NameReservation | null;
  storedProfile: StoredIdentityProfile | null;
  session: SessionRejoinRecord | null;
  postfixCounter: PostfixCounter | null;
  now?: number;
}

function nextDisplayName(baseName: string, postfix: number): string {
  return postfix <= 1 ? baseName : `${baseName}#${postfix}`;
}

export function allocatePostfix(
  baseName: string,
  scope: string,
  counter: PostfixCounter | null
): { displayName: string; nextCounter: PostfixCounter } {
  const normalized = normalizeBaseName(baseName);
  const next = counter?.nextPostfix ?? 2;
  const displayName = nextDisplayName(stripPostfix(baseName), next);
  return {
    displayName,
    nextCounter: {
      baseName: normalized,
      scope: counter?.scope ?? scope,
      nextPostfix: next + 1,
    },
  };
}

/**
 * Resolve whether the joiner gets the exact name or a neutral postfix.
 * Binary outcome only: same_user | not_same_user.
 */
export function resolveIdentityJoin(input: ResolveNameInput): IdentityJoinResult {
  const now = input.now ?? Date.now();
  const baseName = stripPostfix(input.desiredName);
  const normalized = normalizeBaseName(baseName);

  const confidence = computeConfidence(
    input.claimsFingerprint,
    input.claimsNetwork,
    input.claimsBehavior,
    input.storedProfile,
    input.session,
    input.roomId,
    now
  );

  const profile =
    input.storedProfile ??
    buildStoredProfile(
      input.claimsFingerprint,
      input.claimsNetwork,
      input.claimsBehavior
    );

  const reservation = input.existingReservation;
  const nameTaken =
    reservation && normalizeBaseName(reservation.baseName) === normalized;

  if (!nameTaken) {
    return {
      decision: 'same_user',
      displayName: baseName,
      identityHash: profile.identityHash,
      welcomeBack: false,
      confidence,
    };
  }

  const ownsReservation = reservation!.identityHash === profile.identityHash;

  if (isSameUser(confidence) && (ownsReservation || confidence.total >= CONFIDENCE_THRESHOLD)) {
    return {
      decision: 'same_user',
      displayName: reservation!.displayName,
      identityHash: reservation!.identityHash,
      welcomeBack: confidence.sessionMatch >= 60,
      confidence,
    };
  }

  const { displayName, nextCounter } = allocatePostfix(
    baseName,
    input.scope,
    input.postfixCounter
  );

  return {
    decision: 'not_same_user',
    displayName,
    identityHash: profile.identityHash,
    welcomeBack: false,
    nameInUseMessage: 'That name is already in use.',
    confidence,
  };
}

export function decisionFromConfidence(
  confidence: ConfidenceScoreInternal
): IdentityDecision {
  return isSameUser(confidence) ? 'same_user' : 'not_same_user';
}
