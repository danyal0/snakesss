import type { APIRequestContext } from '@playwright/test';

const SERVER = 'http://127.0.0.1:3001';

export async function resetE2EState(api: APIRequestContext): Promise<void> {
  await api.post(`${SERVER}/api/e2e/reset`);
}

export async function setDeterministicSeed(
  api: APIRequestContext,
  seed: string
): Promise<void> {
  await api.post(`${SERVER}/api/e2e/seed`, { data: { seed } });
}

export interface E2ERoom {
  roomId: string;
  state?: { phase: string; roomId: string };
}

export async function createE2ERoom(
  api: APIRequestContext,
  options: { username?: string; bots?: number; fastTimers?: boolean } = {}
): Promise<E2ERoom> {
  const res = await api.post(`${SERVER}/api/e2e/rooms`, {
    data: {
      username: options.username ?? 'E2EHost',
      bots: options.bots ?? 2,
      fastTimers: options.fastTimers ?? true,
    },
  });
  const json = (await res.json()) as {
    success: boolean;
    data: { roomId: string; state: { phase: string; roomId: string } };
  };
  if (!json.success) throw new Error('Failed to create E2E room');
  return { roomId: json.data.roomId, state: json.data.state };
}

export async function startE2EGame(
  api: APIRequestContext,
  roomId: string
): Promise<void> {
  const res = await api.post(`${SERVER}/api/e2e/rooms/${roomId}/start`);
  const json = (await res.json()) as { success: boolean; error?: string };
  if (!json.success) throw new Error(json.error ?? 'start failed');
}

export async function forceE2EPhase(
  api: APIRequestContext,
  roomId: string,
  phase: string
): Promise<void> {
  await api.post(`${SERVER}/api/e2e/rooms/${roomId}/force-phase`, {
    data: { phase },
  });
}
