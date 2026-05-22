import { create } from 'zustand';
import type { AdminState, GameState, RoomSummary, Analytics } from '@snakesss/shared-types';

interface AdminStore {
  isAuthenticated: boolean;
  token: string | null;
  adminState: AdminState | null;
  selectedRoomId: string | null;
  selectedRoomState: GameState | null;

  login: (token: string) => void;
  logout: () => void;
  setAdminState: (state: AdminState) => void;
  setSelectedRoom: (roomId: string | null, state?: GameState) => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  isAuthenticated: !!localStorage.getItem('admin_token'),
  token: localStorage.getItem('admin_token'),
  adminState: null,
  selectedRoomId: null,
  selectedRoomState: null,

  login: (token) => {
    localStorage.setItem('admin_token', token);
    set({ isAuthenticated: true, token });
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    set({ isAuthenticated: false, token: null });
  },

  setAdminState: (state) => set({ adminState: state }),

  setSelectedRoom: (roomId, state) =>
    set({ selectedRoomId: roomId, selectedRoomState: state ?? null }),
}));
