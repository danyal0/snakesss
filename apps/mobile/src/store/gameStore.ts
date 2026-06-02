import { create } from 'zustand';
import type { GameState, Role, ChatMessage, TypingIndicator, WinCondition, RoundVotes } from '@snakesss/shared-types';

interface MobileGameStore {
  isConnected: boolean;
  socketId: string | null;
  playerId: string | null;
  username: string | null;
  gameState: GameState | null;
  myRole: Role | null;
  typingIndicators: TypingIndicator[];
  lastRoundResult: RoundVotes | null;
  winner: WinCondition;
  showRoleReveal: boolean;

  setConnected: (v: boolean, id?: string) => void;
  setGameState: (s: GameState) => void;
  patchGameState: (p: Partial<GameState>) => void;
  setMyRole: (r: Role) => void;
  addMessage: (m: ChatMessage) => void;
  updateVoteTally: (v: Record<string, string>) => void;
  setTyping: (t: TypingIndicator) => void;
  setWinner: (w: WinCondition, _playerIds?: string[]) => void;
  setShowRoleReveal: (v: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<MobileGameStore>((set) => ({
  isConnected: false,
  socketId: null,
  playerId: null,
  username: null,
  gameState: null,
  myRole: null,
  typingIndicators: [],
  lastRoundResult: null,
  winner: null,
  showRoleReveal: false,

  setConnected: (v, id) => set({ isConnected: v, socketId: id ?? null }),
  setGameState: (s) => set({ gameState: s }),
  patchGameState: (p) => set((st) => ({ gameState: st.gameState ? { ...st.gameState, ...p } : null })),
  setMyRole: (r) => set({ myRole: r, showRoleReveal: true }),
  addMessage: (m) => set((st) => ({
    gameState: st.gameState ? { ...st.gameState, chat: [...st.gameState.chat, m] } : null,
  })),
  updateVoteTally: (v) => set((st) => ({ gameState: st.gameState ? { ...st.gameState, votes: v } : null })),
  setTyping: (t) => set((st) => {
    const filtered = st.typingIndicators.filter((x) => x.playerId !== t.playerId);
    return { typingIndicators: t.isTyping ? [...filtered, t] : filtered };
  }),
  setWinner: (w) => set({ winner: w }),
  setShowRoleReveal: (v) => set({ showRoleReveal: v }),
  reset: () => set({
    gameState: null, myRole: null, typingIndicators: [],
    lastRoundResult: null, winner: null, showRoleReveal: false,
  }),
}));
