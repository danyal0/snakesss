import { randomUUID } from 'crypto';

export function generateId(prefix = ''): string {
  const uuid = randomUUID().replace(/-/g, '').slice(0, 10);
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export function generateRoomCode(length = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** True if code matches room id format (4 chars, allowed charset). */
export function isValidRoomCode(code: string): boolean {
  return /^[A-HJ-NP-Z2-9]{4}$/i.test(code.trim());
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}
