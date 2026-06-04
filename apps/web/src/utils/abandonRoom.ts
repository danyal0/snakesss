import { useGameStore } from '../store/gameStore';
import { clearSession, getRoomIdFromPath } from '../hooks/useSession';
import { clearActiveRoom } from './userProfile';

/** Drop saved room session and in-memory game state (e.g. room destroyed or rejoin failed). */
export function abandonRoom(roomId?: string): void {
  const id = (roomId ?? getRoomIdFromPath())?.toUpperCase();
  if (id) clearSession(id);
  clearActiveRoom();
  useGameStore.getState().reset();
}
