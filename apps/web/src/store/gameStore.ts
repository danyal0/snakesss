import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  GameState,
  Player,
  ChatMessage,
  Role,
  TypingIndicator,
  RoundVotes,
  WinCondition,
} from '@snakesss/shared-types';

interface GameStore {
  // Connection
  isConnected: boolean;
  socketId: string | null;

  // Room
  roomId: string | null;
  playerId: string | null;
  username: string | null;

  // Game state (mirror of server)
  gameState: GameState | null;
  myRole: Role | null;

  // UI state
  typingIndicators: TypingIndicator[];
  lastRoundResult: RoundVotes | null;
  winner: WinCondition;
  showRoleReveal: boolean;
  showEliminationReveal: boolean;
  eliminatedPlayer: Player | null;
  chatInput: string;
  isTyping: boolean;

  // Actions
  setConnected: (connected: boolean, socketId?: string) => void;
  setGameState: (state: GameState) => void;
  patchGameState: (patch: Partial<GameState>) => void;
  setMyRole: (role: Role) => void;
  addMessage: (message: ChatMessage) => void;
  updateVotes: (votes: Record<string, string>) => void;
  setTyping: (indicator: TypingIndicator) => void;
  setRoundResult: (result: RoundVotes) => void;
  setWinner: (winner: WinCondition) => void;
  setShowRoleReveal: (show: boolean) => void;
  setShowElimination: (show: boolean, player?: Player) => void;
  setChatInput: (input: string) => void;
  setIsTyping: (typing: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set) => ({
    isConnected: false,
    socketId: null,
    roomId: null,
    playerId: null,
    username: null,
    gameState: null,
    myRole: null,
    typingIndicators: [],
    lastRoundResult: null,
    winner: null,
    showRoleReveal: false,
    showEliminationReveal: false,
    eliminatedPlayer: null,
    chatInput: '',
    isTyping: false,

    setConnected: (connected, socketId) =>
      set({ isConnected: connected, socketId: socketId ?? null }),

    setGameState: (state) =>
      set({ gameState: state, roomId: state.roomId }),

    patchGameState: (patch) =>
      set((s) => ({
        gameState: s.gameState ? { ...s.gameState, ...patch } : null,
      })),

    setMyRole: (role) =>
      set({ myRole: role, showRoleReveal: true }),

    addMessage: (message) =>
      set((s) => ({
        gameState: s.gameState
          ? { ...s.gameState, chat: [...s.gameState.chat, message] }
          : null,
      })),

    updateVotes: (votes) =>
      set((s) => ({
        gameState: s.gameState ? { ...s.gameState, votes } : null,
      })),

    setTyping: (indicator) =>
      set((s) => {
        const filtered = s.typingIndicators.filter(
          (t) => t.playerId !== indicator.playerId
        );
        return {
          typingIndicators: indicator.isTyping ? [...filtered, indicator] : filtered,
        };
      }),

    setRoundResult: (result) => set({ lastRoundResult: result }),

    setWinner: (winner) => set({ winner }),

    setShowRoleReveal: (show) => set({ showRoleReveal: show }),

    setShowElimination: (show, player) =>
      set({ showEliminationReveal: show, eliminatedPlayer: player ?? null }),

    setChatInput: (input) => set({ chatInput: input }),

    setIsTyping: (typing) => set({ isTyping: typing }),

    reset: () =>
      set({
        roomId: null,
        gameState: null,
        myRole: null,
        typingIndicators: [],
        lastRoundResult: null,
        winner: null,
        showRoleReveal: false,
        showEliminationReveal: false,
        eliminatedPlayer: null,
        chatInput: '',
        isTyping: false,
      }),
  }))
);

// Selectors
export const selectMyPlayer = (state: GameStore) => {
  if (!state.gameState || !state.playerId) return null;
  return state.gameState.players.find((p) => p.id === state.playerId) ?? null;
};

export const selectAlivePlayers = (state: GameStore) =>
  state.gameState?.players.filter((p) => p.isAlive && !p.isSpectator) ?? [];

export const selectIsMyTurn = (_state: GameStore) => true;

export const selectCanVote = (state: GameStore) => {
  if (!state.gameState || !state.playerId) return false;
  const me = state.gameState.players.find((p) => p.id === state.playerId);
  if (!me?.isAlive || me.isSpectator) return false;
  return state.gameState.phase === 'voting' && !state.gameState.votes[state.playerId];
};

export const selectHasVoted = (state: GameStore) => {
  if (!state.gameState || !state.playerId) return false;
  return !!state.gameState.votes[state.playerId];
};
