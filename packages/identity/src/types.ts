import type { GamePhase } from '@snakesss/shared-types';

/** Raw browser/device signals sent by the client (hashed server-side). */
export interface FingerprintSignals {
  userAgent: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  language: string;
  webglVendorHash: string;
  audioFingerprintHash: string;
}

/** Optional behavioral hints for tie-breaking. */
export interface BehavioralSignals {
  joinToActionDelayMs?: number;
  inputCadenceMs?: number;
  interactionRhythm?: number;
}

/** Client-provided identity context on join/create. */
export interface IdentityClaims {
  fingerprint: FingerprintSignals;
  behavioral?: BehavioralSignals;
  clientTimestamp?: number;
}

/** Server-derived network context (never stores raw IP). */
export interface NetworkContext {
  ipHash: string;
  asn?: string;
  country?: string;
  region?: string;
}

/** Hashed device fingerprint — privacy-safe, expirable. */
export interface IdentityFingerprintHash {
  hash: string;
  createdAt: number;
  expiresAt: number;
}

/** Tracks disconnect for session continuity scoring. */
export interface SessionRejoinRecord {
  identityHash: string;
  roomId: string;
  playerId: string;
  username: string;
  displayName: string;
  lastDisconnectAt: number;
  lastPhase: GamePhase;
  expiresAt: number;
}

/** Soft name reservation scoped to room or global leaderboard. */
export interface NameReservation {
  baseName: string;
  displayName: string;
  identityHash: string;
  scope: string;
  playerId?: string;
  reservedAt: number;
  expiresAt: number;
}

/** Internal confidence breakdown — never exposed to clients. */
export interface ConfidenceScoreInternal {
  fingerprintMatch: number;
  networkMatch: number;
  sessionMatch: number;
  behaviorMatch: number;
  total: number;
  computedAt: number;
}

/** Per-scope postfix counter for Name#2, Name#3, … */
export interface PostfixCounter {
  baseName: string;
  scope: string;
  nextPostfix: number;
}

/** Stored identity profile linked to a player slot. */
export interface StoredIdentityProfile {
  identityHash: string;
  fingerprintHash: string;
  componentHashes: Record<keyof FingerprintSignals, string>;
  networkContext: NetworkContext;
  behavioral?: BehavioralSignals;
  lastSeenAt: number;
}

/** Binary join outcome — only these two paths exist. */
export type IdentityDecision = 'same_user' | 'not_same_user';

export interface IdentityJoinResult {
  decision: IdentityDecision;
  displayName: string;
  identityHash: string;
  welcomeBack: boolean;
  nameInUseMessage?: string;
  confidence: ConfidenceScoreInternal;
}

export const CONFIDENCE_THRESHOLD = 45;
export const SESSION_REJOIN_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
export const DEFAULT_RESERVATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_LEADERBOARD_INACTIVITY_MS = 90 * 24 * 60 * 60 * 1000;
