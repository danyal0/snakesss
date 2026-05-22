import type { GameState } from '@snakesss/shared-types';
import { useGameStore } from '../store/gameStore';

/**
 * Persist the player's room session so they can rejoin after a page refresh.
 * Stored under the key `snakesss_session_<roomId>` in localStorage.
 */

export interface StoredSession {
  roomId: string;
  username: string;
  avatar: string;
  savedAt: number;
}

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(
      `snakesss_session_${session.roomId}`,
      JSON.stringify({ ...session, savedAt: Date.now() })
    );
  } catch {
    // localStorage may be unavailable (private browsing etc.)
  }
}

export function loadSession(roomId: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(`snakesss_session_${roomId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredSession;
    if (Date.now() - data.savedAt > SESSION_TTL_MS) {
      clearSession(roomId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearSession(roomId: string): void {
  try {
    localStorage.removeItem(`snakesss_session_${roomId}`);
  } catch {}
}

/** Match server player slot by username (stable across socket reconnects). */
export function resolvePlayerId(
  state: GameState,
  username: string,
  fallbackSocketId: string | null
): string | null {
  const me = state.players.find(
    (p) =>
      p.username.toLowerCase().trim() === username.toLowerCase().trim() &&
      !p.isSpectator
  );
  return me?.id ?? fallbackSocketId;
}

export function isRegisteredPlayer(
  state: GameState,
  playerId: string | null
): boolean {
  if (!playerId) return false;
  const p = state.players.find((pl) => pl.id === playerId);
  return !!p && !p.isSpectator;
}

/** Apply a successful room join/create to store + localStorage. */
export function applyRoomIdentity(
  state: GameState,
  roomId: string,
  username: string,
  avatar: string,
  socketId: string | null
): void {
  const playerId = resolvePlayerId(state, username, socketId);
  useGameStore.setState({ playerId, username, gameState: state });
  saveSession({ roomId, username, avatar, savedAt: Date.now() });
}
