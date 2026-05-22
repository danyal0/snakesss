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
import { syncEphemeralFromGameState } from './syncEphemeralState';

interface GameStore {
  isConnected: boolean;
  socketId: string | null;
  playerId: string | null;
  username: string | null;
  gameState: GameState | null;
  myRole: Role | null;
  snakeAnswer: AnswerIndex | null;
  hasSubmittedAnswer: boolean;
  answerCount: number;
  answerTotal: number;
  quizRevealAnswers: PlayerAnswer[];
  quizRevealCorrectIndex: AnswerIndex | null;
  quizRevealScores: RoundScore[];
  showQuizReveal: boolean;
  lastSocketError: string | null;
  typingIndicators: TypingIndicator[];
  lastRoundResult: RoundVotes | null;
  winner: WinCondition;
  showRoleReveal: boolean;
  showEliminationReveal: boolean;
  eliminatedPlayer: Player | null;
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
  setLastSocketError: (msg: string | null) => void;
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
    lastSocketError: null,
    showRoleReveal: false,
    showEliminationReveal: false,
    eliminatedPlayer: null,

    setConnected: (v, id) => set({ isConnected: v, socketId: id ?? null }),

    setGameState: (s) =>
      set((st) => {
        let merged: GameState;
        if (!st.gameState) {
          merged = s;
        } else {
          const existingIds = new Set(st.gameState.chat.map((c) => c.id));
          const serverOnlyMsgs = s.chat.filter((c) => !existingIds.has(c.id));
          const mergedChat = [...st.gameState.chat, ...serverOnlyMsgs]
            .sort((a, b) => a.timestamp - b.timestamp);
          merged = { ...s, chat: mergedChat };
        }
        return {
          gameState: merged,
          ...syncEphemeralFromGameState(merged, st.playerId),
        };
      }),

    patchGameState: (p) =>
      set((st) => {
        if (!st.gameState) return { gameState: null };
        const merged = { ...st.gameState, ...p };
        return {
          gameState: merged,
          ...syncEphemeralFromGameState(merged, st.playerId),
        };
      }),

    setMyRole: (role) =>
      set((st) => ({
        myRole: role,
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
      set((st) => {
        if (!st.gameState) return {};
        if (st.gameState.chat.some((c) => c.id === m.id)) return {};
        return { gameState: { ...st.gameState, chat: [...st.gameState.chat, m] } };
      }),

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

    setLastSocketError: (msg) => set({ lastSocketError: msg }),
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
        lastSocketError: null,
        showRoleReveal: false,
        showEliminationReveal: false,
        eliminatedPlayer: null,
      }),
  }))
);

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
