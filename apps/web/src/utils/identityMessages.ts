import type { JoinRoomMeta } from '@snakesss/shared-types';

/** Apply server join meta to UI state (never shows confidence). */
export function applyJoinMeta(meta: JoinRoomMeta | undefined): {
  displayUsername: string;
  toast?: string;
} {
  if (!meta) {
    return { displayUsername: '' };
  }
  const toast = meta.nameInUseMessage
    ? meta.nameInUseMessage
    : meta.welcomeBack
      ? 'Welcome back'
      : undefined;
  return {
    displayUsername: meta.displayName,
    toast,
  };
}
