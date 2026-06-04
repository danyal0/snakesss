import type { AvatarEmoji } from '@snakesss/shared-types';

const PROFILE_KEY = 'snakesss_user_profile';

export interface UserProfile {
  username: string;
  avatar: AvatarEmoji;
  /** Last room the user joined or created (for home/back redirect). */
  activeRoomId?: string;
  /** Join as player when room returns to lobby (mid-game queue). */
  queuedForNextGame?: boolean;
  wasRoomManager?: boolean;
  savedAt: number;
}

export function loadUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveUserProfile(profile: Partial<UserProfile> & Pick<UserProfile, 'username' | 'avatar'>): void {
  try {
    const prev = loadUserProfile();
    const next: UserProfile = {
      username: profile.username,
      avatar: profile.avatar,
      activeRoomId: profile.activeRoomId ?? prev?.activeRoomId,
      queuedForNextGame: profile.queuedForNextGame ?? prev?.queuedForNextGame,
      wasRoomManager: profile.wasRoomManager ?? prev?.wasRoomManager,
      savedAt: Date.now(),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function clearActiveRoom(): void {
  const prev = loadUserProfile();
  if (!prev) return;
  saveUserProfile({ ...prev, activeRoomId: undefined, queuedForNextGame: false });
}

export function setActiveRoom(roomId: string, opts?: { wasManager?: boolean; queue?: boolean }): void {
  const prev = loadUserProfile();
  if (!prev) return;
  saveUserProfile({
    ...prev,
    activeRoomId: roomId.toUpperCase(),
    wasRoomManager: opts?.wasManager ?? prev.wasRoomManager,
    queuedForNextGame: opts?.queue ?? prev.queuedForNextGame,
  });
}
