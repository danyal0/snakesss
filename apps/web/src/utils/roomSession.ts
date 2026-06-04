import type { GameState } from '@snakesss/shared-types';
import { useGameStore } from '../store/gameStore';
import { getRoomIdFromPath, isRegisteredPlayer, loadSession } from '../hooks/useSession';

/** True when joinRoom is in flight for this room (back should cancel silently). */
let joinInFlightRoomId: string | null = null;

export function setJoinInFlight(roomId: string | null): void {
  joinInFlightRoomId = roomId ? roomId.toUpperCase() : null;
}

export function isJoinInFlight(roomId?: string | null): boolean {
  if (!joinInFlightRoomId) return false;
  if (!roomId) return true;
  return joinInFlightRoomId === roomId.toUpperCase();
}

/**
 * Whether leaving the current room route should show a confirmation dialog.
 * Only after the player is registered in server state for this room.
 */
export function shouldConfirmRoomLeave(pathname?: string): boolean {
  if (typeof window === 'undefined') return false;
  const path = pathname ?? window.location.pathname;
  const roomId = getRoomIdFromPath();
  if (!roomId || !path.startsWith('/room/')) return false;
  if (isJoinInFlight(roomId)) return false;

  const store = useGameStore.getState();
  const state = store.gameState;
  if (!state || state.roomId !== roomId) return false;

  if (isRegisteredPlayer(state, store.playerId)) return true;

  const session = loadSession(roomId);
  if (session?.playerId) {
    const slot = state.players.find((p) => p.id === session.playerId && !p.isSpectator);
    if (slot) return true;
  }

  return false;
}

export function isRegisteredInRoom(state: GameState | null, playerId: string | null): boolean {
  if (!state || !playerId) return false;
  return isRegisteredPlayer(state, playerId);
}
