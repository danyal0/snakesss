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
    // Expire old sessions
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
