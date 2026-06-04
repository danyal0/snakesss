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
  playerId?: string;
  wasRoomManager?: boolean;
  queuedForNextGame?: boolean;
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

/** Read room id from `/room/:roomId` when on a room page (works before React Router mounts). */
export function getRoomIdFromPath(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/\/room\/([^/]+)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

/** Match server player slot by username (stable across socket reconnects). */
export function resolvePlayerId(
  state: GameState,
  username: string,
  fallbackSocketId: string | null,
  savedPlayerId?: string | null
): string | null {
  if (savedPlayerId) {
    const byId = state.players.find((p) => p.id === savedPlayerId && !p.isSpectator);
    if (byId) return byId.id;
  }
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
  const session = loadSession(roomId);
  const playerId = resolvePlayerId(
    state,
    username,
    socketId,
    session?.playerId
  );
  useGameStore.setState({ playerId, username, gameState: state });
  const me = playerId ? state.players.find((p) => p.id === playerId) : undefined;
  saveSession({
    roomId,
    username,
    avatar,
    playerId: playerId ?? undefined,
    wasRoomManager: me?.isRoomManager,
    savedAt: Date.now(),
  });
}

/** Sync playerId from session + game state (safe to call on every state:full). */
export function syncPlayerIdentityFromState(
  state: GameState,
  socketId: string | null
): void {
  const session = loadSession(state.roomId);
  if (!session) return;

  const store = useGameStore.getState();
  const playerId = resolvePlayerId(
    state,
    session.username,
    socketId,
    session.playerId
  );

  if (!playerId || !isRegisteredPlayer(state, playerId)) return;

  if (store.playerId !== playerId || store.username !== session.username) {
    useGameStore.setState({
      playerId,
      username: session.username,
    });
  }
}
