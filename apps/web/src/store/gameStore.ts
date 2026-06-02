import { syncEphemeralFromGameState } from './syncEphemeralState';
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

  // Socket error (auto-cleared)
  lastSocketError: string | null;

  // UI overlays
  typingIndicators: TypingIndicator[];
  lastRoundResult: RoundVotes | null;
  winner: WinCondition;
  winnerPlayerIds: string[];
  showRoleReveal: boolean;
  showEliminationReveal: boolean;
  eliminatedPlayer: Player | null;
  voteTally: Record<string, number>;
  hasVoted: boolean;
  myVoteTarget: string | null;

  // Actions
  setConnected: (v: boolean, id?: string) => void;
  setGameState: (s: GameState) => void;
  patchGameState: (p: Partial<GameState>) => void;
  setMyRole: (role: Role, showReveal?: boolean) => void;
  setSnakeAnswer: (a: AnswerIndex | null) => void;
  setQuizReveal: (answers: PlayerAnswer[], correctIndex: AnswerIndex, scores: RoundScore[]) => void;
  addMessage: (m: ChatMessage) => void;
  updateVoteTally: (counts: Record<string, number>) => void;
  setMyVote: (targetId: string) => void;
  clearVoteState: () => void;
  setTyping: (t: TypingIndicator) => void;
  setRoundResult: (r: RoundVotes) => void;
  setWinner: (w: WinCondition, playerIds?: string[]) => void;
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
    winnerPlayerIds: [],
    lastSocketError: null,
    showRoleReveal: false,
    showEliminationReveal: false,
    eliminatedPlayer: null,
    voteTally: {},
    hasVoted: false,
    myVoteTarget: null,

    setConnected: (v, id) => set({ isConnected: v, socketId: id ?? null }),

    setGameState: (s) =>
      set((st) => {
        // When state:full arrives, merge chat to avoid losing locally-added messages
        // and deduplicate by message ID
        if (!st.gameState) return { gameState: s };
        const existingIds = new Set(st.gameState.chat.map((c) => c.id));
        const serverOnlyMsgs = s.chat.filter((c) => !existingIds.has(c.id));
        const mergedChat = [...st.gameState.chat, ...serverOnlyMsgs]
          .sort((a, b) => a.timestamp - b.timestamp);
        // Use server state but with merged chat to avoid drops
        return { gameState: { ...s, chat: mergedChat } };
      }),

    patchGameState: (p) =>
      set((st) => ({ gameState: st.gameState ? { ...st.gameState, ...p } : null })),

    setMyRole: (role, showReveal = false) =>
      set((st) => ({
        myRole: role,
        showRoleReveal: showReveal || !st.myRole,
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
        // Deduplicate by message ID — guards against state:full + chat:message race
        if (st.gameState.chat.some((c) => c.id === m.id)) return {};
        return { gameState: { ...st.gameState, chat: [...st.gameState.chat, m] } };
      }),

    updateVoteTally: (counts) => set({ voteTally: counts }),

    setMyVote: (targetId) => set({ hasVoted: true, myVoteTarget: targetId }),

    clearVoteState: () => set({ voteTally: {}, hasVoted: false, myVoteTarget: null }),

    setTyping: (t) =>
      set((st) => ({
        typingIndicators: t.isTyping
          ? [...st.typingIndicators.filter((x) => x.playerId !== t.playerId), t]
          : st.typingIndicators.filter((x) => x.playerId !== t.playerId),
      })),

    setRoundResult: (r) => set({ lastRoundResult: r }),

    setWinner: (w, playerIds = []) => set({ winner: w, winnerPlayerIds: playerIds }),

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
        winnerPlayerIds: [],
        lastSocketError: null,
      showRoleReveal: false,
        showEliminationReveal: false,
        eliminatedPlayer: null,
        voteTally: {},
        hasVoted: false,
        myVoteTarget: null,
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
  return state.gameState.phase === 'voting' && !state.hasVoted;
};

export const selectHasVoted = (state: GameStore) => state.hasVoted;
