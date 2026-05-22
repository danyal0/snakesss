import { useAdminStore } from '../store/adminStore';

const BASE = `${import.meta.env['VITE_SERVER_URL'] ?? 'http://localhost:3001'}/api/admin`;

export function useAdminAPI() {
  const token = useAdminStore((s) => s.token);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token ?? ''}`,
  };

  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, { headers });
    const data = await res.json() as { success: boolean; data: T; error?: string };
    if (!data.success) throw new Error(data.error ?? 'Request failed');
    return data.data;
  };

  const post = async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as { success: boolean; data: T; error?: string };
    if (!data.success) throw new Error(data.error ?? 'Request failed');
    return data.data;
  };

  return {
    getRooms: () => get('/rooms'),
    getRoom: (roomId: string) => get(`/rooms/${roomId}`),
    getAnalytics: () => get('/analytics'),
    pauseRoom: (roomId: string) => post(`/rooms/${roomId}/pause`),
    resumeRoom: (roomId: string) => post(`/rooms/${roomId}/resume`),
    kickPlayer: (roomId: string, playerId: string) => post(`/rooms/${roomId}/kick/${playerId}`),
    banPlayer: (roomId: string, playerId: string) => post(`/rooms/${roomId}/ban/${playerId}`),
    injectBot: (roomId: string, persona: string) => post(`/rooms/${roomId}/bot`, { persona }),
    updateSettings: (roomId: string, settings: unknown) => post(`/rooms/${roomId}/settings`, settings),
    closeRoom: (roomId: string) => post(`/rooms/${roomId}/close`),
  };
}
