const roomTimers = new Map<string, Set<ReturnType<typeof setTimeout>>>();

export function scheduleRoomBotTimeout(
  roomId: string,
  fn: () => void,
  delayMs: number
): ReturnType<typeof setTimeout> {
  let set = roomTimers.get(roomId);
  if (!set) {
    set = new Set();
    roomTimers.set(roomId, set);
  }
  const id = setTimeout(() => {
    set!.delete(id);
    fn();
  }, delayMs);
  set.add(id);
  return id;
}

export function clearRoomBotTimers(roomId: string): void {
  const set = roomTimers.get(roomId);
  if (!set) return;
  for (const id of set) clearTimeout(id);
  set.clear();
}
