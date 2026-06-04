import type { GamePhase } from '@snakesss/shared-types';
import type {
  IdentityClaims,
  NameReservation,
  NetworkContext,
  PostfixCounter,
  SessionRejoinRecord,
  StoredIdentityProfile,
} from '@snakesss/identity';
import {
  buildStoredProfile,
  DEFAULT_RESERVATION_TTL_MS,
  DEFAULT_SESSION_TTL_MS,
  normalizeBaseName,
  resolveIdentityJoin,
  stripPostfix,
} from '@snakesss/identity';
import { hashIp } from '@snakesss/identity';

export interface JoinIdentityContext {
  socketIp: string;
  country?: string;
  region?: string;
  asn?: string;
}

export interface ProcessJoinIdentityResult {
  displayName: string;
  identityHash: string;
  welcomeBack: boolean;
  nameInUseMessage?: string;
  profile: StoredIdentityProfile;
}

export class IdentityStore {
  private profiles = new Map<string, StoredIdentityProfile>();
  private reservations = new Map<string, NameReservation>();
  private sessions = new Map<string, SessionRejoinRecord>();
  private postfixCounters = new Map<string, PostfixCounter>();
  private playerIdentity = new Map<string, string>();

  constructor() {
    setInterval(() => this.purgeExpired(), 60_000);
  }

  private reservationKey(scope: string, baseName: string): string {
    return `${scope}:${normalizeBaseName(baseName)}`;
  }

  private sessionKey(roomId: string, playerId: string): string {
    return `${roomId}:${playerId}`;
  }

  private profileKey(identityHash: string): string {
    return identityHash;
  }

  purgeExpired(now = Date.now()): void {
    for (const [k, v] of this.reservations) {
      if (v.expiresAt <= now) this.reservations.delete(k);
    }
    for (const [k, v] of this.sessions) {
      if (v.expiresAt <= now) this.sessions.delete(k);
    }
  }

  buildNetworkContext(ctx: JoinIdentityContext): NetworkContext {
    return {
      ipHash: hashIp(ctx.socketIp),
      asn: ctx.asn,
      country: ctx.country,
      region: ctx.region,
    };
  }

  getProfile(identityHash: string): StoredIdentityProfile | null {
    return this.profiles.get(this.profileKey(identityHash)) ?? null;
  }

  getProfileForPlayer(roomId: string, playerId: string): StoredIdentityProfile | null {
    const hash = this.playerIdentity.get(`${roomId}:${playerId}`);
    if (!hash) return null;
    return this.getProfile(hash);
  }

  getSession(roomId: string, playerId: string): SessionRejoinRecord | null {
    return this.sessions.get(this.sessionKey(roomId, playerId)) ?? null;
  }

  getReservation(scope: string, desiredName: string): NameReservation | null {
    const base = normalizeBaseName(stripPostfix(desiredName));
    return this.reservations.get(this.reservationKey(scope, base)) ?? null;
  }

  getPostfixCounter(scope: string, desiredName: string): PostfixCounter | null {
    const base = normalizeBaseName(stripPostfix(desiredName));
    return this.postfixCounters.get(this.reservationKey(scope, base)) ?? null;
  }

  processJoin(
    desiredName: string,
    roomId: string,
    claims: IdentityClaims,
    ctx: JoinIdentityContext,
    playerIdForSession?: string
  ): ProcessJoinIdentityResult {
    const scope = roomId;
    const network = this.buildNetworkContext(ctx);
    const existingReservation = this.getReservation(scope, desiredName);
    const stored =
      existingReservation
        ? this.getProfile(existingReservation.identityHash)
        : playerIdForSession
          ? this.getProfileForPlayer(roomId, playerIdForSession)
          : null;

    const session =
      playerIdForSession
        ? this.getSession(roomId, playerIdForSession)
        : null;

    const result = resolveIdentityJoin({
      desiredName,
      roomId,
      scope,
      claimsFingerprint: claims.fingerprint,
      claimsNetwork: network,
      claimsBehavior: claims.behavioral,
      existingReservation,
      storedProfile: stored,
      session,
      postfixCounter: this.getPostfixCounter(scope, desiredName),
    });

    const profile = buildStoredProfile(
      claims.fingerprint,
      network,
      claims.behavioral
    );
    this.profiles.set(this.profileKey(profile.identityHash), {
      ...profile,
      lastSeenAt: Date.now(),
    });

    if (result.decision === 'not_same_user') {
      const base = normalizeBaseName(stripPostfix(desiredName));
      const counter = this.getPostfixCounter(scope, desiredName);
      const next = (counter?.nextPostfix ?? 2) + 1;
      this.postfixCounters.set(this.reservationKey(scope, base), {
        baseName: base,
        scope,
        nextPostfix: next,
      });
    }

    const now = Date.now();
    this.reservations.set(
      this.reservationKey(scope, normalizeBaseName(result.displayName)),
      {
        baseName: normalizeBaseName(stripPostfix(result.displayName)),
        displayName: result.displayName,
        identityHash: result.identityHash,
        scope,
        reservedAt: now,
        expiresAt: now + DEFAULT_RESERVATION_TTL_MS,
      }
    );

    return {
      displayName: result.displayName,
      identityHash: result.identityHash,
      welcomeBack: result.welcomeBack,
      nameInUseMessage: result.nameInUseMessage,
      profile,
    };
  }

  linkPlayer(roomId: string, playerId: string, identityHash: string): void {
    this.playerIdentity.set(`${roomId}:${playerId}`, identityHash);
  }

  recordDisconnect(
    roomId: string,
    playerId: string,
    username: string,
    displayName: string,
    identityHash: string,
    phase: GamePhase
  ): void {
    const now = Date.now();
    this.sessions.set(this.sessionKey(roomId, playerId), {
      identityHash,
      roomId,
      playerId,
      username,
      displayName,
      lastDisconnectAt: now,
      lastPhase: phase,
      expiresAt: now + DEFAULT_SESSION_TTL_MS,
    });
  }

}

export const identityStore = new IdentityStore();
