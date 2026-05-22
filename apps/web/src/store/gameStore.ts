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
  PlayerAnswer,
  RoundScore,
  AnswerIndex,
} from '@snakesss/shared-types';

interface GameStore {
  // Connection
  isConnected: boolean;
  socketId: string | null;

  // Identity
  playerId: string | null;
  username: string | null;

  // Game state mirror
  gameState: GameState | null;
  myRole: Role | null;

  // Quiz state
  snakeAnswer: AnswerIndex | null;    // only for snakes — the correct answer
  hasSubmittedAnswer: boolean;
  answerCount: number;
  answerTotal: number;
  quizRevealAnswers: PlayerAnswer[];
  quizRevealCorrectIndex: AnswerIndex | null;
  quizRevealScores: RoundScore[];
  showQuizReveal: boolean;

  // UI overlays
  typingIndicators: TypingIndicator[];
  lastRoundResult: RoundVotes | null;
  winner: WinCondition;
  showRoleReveal: boolean;
  showEliminationReveal: boolean;
  eliminatedPlayer: Player | null;

  // Actions
  setConnected: (v: boolean, id?: string) => void;
  setGameState: (s: GameState) => void;
  patchGameState: (p: Partial<GameState>) => void;
  setMyRole: (r: Role) => void;
  setSnakeAnswer: (a: AnswerIndex | null) => void;
  setQuizReveal: (answers: PlayerAnswer[], correctIndex: AnswerIndex, scores: RoundScore[]) => void;
  addMessage: (m: ChatMessage) => void;
  updateVotes: (v: Record<string, string>) => void;
  setTyping: (t: TypingIndicator) => void;
  setRoundResult: (r: RoundVotes) => void;
  setWinner: (w: WinCondition) => void;
  setShowRoleReveal: (v: boolean) => void;
  setShowElimination: (v: boolean, player?: Player) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set) => ({
    isConnected: false,
    socketId: null,
    playerId: null,
    username: null,
    gameState: null,
    myRole: null,
    snakeAnswer: null,
    hasSubmittedAnswer: false,
    answerCount: 0,
    answerTotal: 0,
    quizRevealAnswers: [],
    quizRevealCorrectIndex: null,
    quizRevealScores: [],
    showQuizReveal: false,
    typingIndicators: [],
    lastRoundResult: null,
    winner: null,
    showRoleReveal: false,
    showEliminationReveal: false,
    eliminatedPlayer: null,

    setConnected: (v, id) => set({ isConnected: v, socketId: id ?? null }),

    setGameState: (s) => set({ gameState: s }),

    patchGameState: (p) =>
      set((st) => ({ gameState: st.gameState ? { ...st.gameState, ...p } : null })),

    setMyRole: (role) =>
      set((st) => ({
        myRole: role,
        // Only show reveal if we didn't have a role before (first time)
        showRoleReveal: !st.myRole,
      })),

    setSnakeAnswer: (a) => set({ snakeAnswer: a }),

    setQuizReveal: (answers, correctIndex, scores) =>
      set({
        quizRevealAnswers: answers,
        quizRevealCorrectIndex: correctIndex,
        quizRevealScores: scores,
        showQuizReveal: true,
      }),

    addMessage: (m) =>
      set((st) => ({
        gameState: st.gameState
          ? { ...st.gameState, chat: [...st.gameState.chat, m] }
          : null,
      })),

    updateVotes: (v) =>
      set((st) => ({ gameState: st.gameState ? { ...st.gameState, votes: v } : null })),

    setTyping: (t) =>
      set((st) => ({
        typingIndicators: t.isTyping
          ? [...st.typingIndicators.filter((x) => x.playerId !== t.playerId), t]
          : st.typingIndicators.filter((x) => x.playerId !== t.playerId),
      })),

    setRoundResult: (r) => set({ lastRoundResult: r }),

    setWinner: (w) => set({ winner: w }),

    setShowRoleReveal: (v) => set({ showRoleReveal: v }),

    setShowElimination: (v, player) =>
      set({ showEliminationReveal: v, eliminatedPlayer: player ?? null }),

    reset: () =>
      set({
        gameState: null,
        myRole: null,
        snakeAnswer: null,
        hasSubmittedAnswer: false,
        answerCount: 0,
        answerTotal: 0,
        quizRevealAnswers: [],
        quizRevealCorrectIndex: null,
        quizRevealScores: [],
        showQuizReveal: false,
        typingIndicators: [],
        lastRoundResult: null,
        winner: null,
        showRoleReveal: false,
        showEliminationReveal: false,
        eliminatedPlayer: null,
      }),
  }))
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectAlivePlayers = (state: GameStore) =>
  state.gameState?.players.filter((p) => p.isAlive && !p.isSpectator) ?? [];

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
