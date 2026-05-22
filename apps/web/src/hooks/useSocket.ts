import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  AnswerIndex,
  PlayerAnswer,
  RoundScore,
  WinCondition,
  Player,
} from '@snakesss/shared-types';
import { useGameStore } from '../store/gameStore';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] ?? '';

// ─── Singleton socket ─────────────────────────────────────────────────────────
let _socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!_socket) {
    _socket = io(SERVER_URL, {
      autoConnect: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return _socket;
}

// ─── Register all listeners ONCE (call only from App root) ────────────────────
let _listenersRegistered = false;

export function useSocketListeners(): void {
  useEffect(() => {
    if (_listenersRegistered) return;
    _listenersRegistered = true;

    const socket = getSocket();
    socket.connect();

    socket.on('connect', () => {
      useGameStore.setState({ isConnected: true, socketId: socket.id ?? null });
    });

    socket.on('disconnect', () => {
      useGameStore.setState({ isConnected: false });
    });

    socket.on('state:full', (state) => {
      useGameStore.getState().setGameState(state);
    });

    socket.on('state:patch', (patch) => {
      useGameStore.getState().patchGameState(patch);
    });

    socket.on('player:role', (role) => {
      // Only show role reveal once — if we already have a role, just update silently
      const store = useGameStore.getState();
      const hadRole = !!store.myRole;
      store.setMyRole(role);
      if (hadRole) {
        // Don't pop the reveal again if we already saw it
        useGameStore.setState({ showRoleReveal: false });
      }
    });

    socket.on('quiz:question', (_question, snakeAnswer) => {
      useGameStore.getState().setSnakeAnswer(snakeAnswer ?? null);
      useGameStore.setState({ hasSubmittedAnswer: false, answerCount: 0 });
    });

    socket.on('quiz:answer_update', (count, total) => {
      useGameStore.setState({ answerCount: count, answerTotal: total });
    });

    socket.on('quiz:reveal', (answers, correctIndex, scores) => {
      useGameStore.getState().setQuizReveal(answers, correctIndex, scores);
    });

    socket.on('chat:message', (message) => {
      useGameStore.getState().addMessage(message);
    });

    socket.on('chat:typing', (indicator) => {
      useGameStore.getState().setTyping(indicator);
    });

    socket.on('vote:update', (votes) => {
      useGameStore.getState().updateVotes(votes);
    });

    socket.on('round:result', (result) => {
      useGameStore.getState().setRoundResult(result);
    });

    socket.on('game:ended', (winner: WinCondition, players: Player[]) => {
      useGameStore.getState().setWinner(winner);
      useGameStore.getState().patchGameState({ players, phase: 'ended', winner });
    });

    socket.on('phase:changed', (phase, endsAt) => {
      useGameStore.getState().patchGameState({ phase, phaseEndsAt: endsAt });
    });

    socket.on('player:joined', (player) => {
      const current = useGameStore.getState().gameState;
      if (!current) return;
      if (current.players.some((p) => p.id === player.id)) return;
      useGameStore.getState().setGameState({ ...current, players: [...current.players, player] });
    });

    socket.on('player:left', (playerId) => {
      const current = useGameStore.getState().gameState;
      if (!current) return;
      useGameStore.getState().patchGameState({
        players: current.players.map((p) =>
          p.id === playerId ? { ...p, isConnected: false } : p
        ),
      });
    });

    socket.on('error', (msg) => {
      console.error('[Socket]', msg);
    });

    // No cleanup — socket lives for the app lifetime
  }, []);
}

// ─── Actions hook (call from any component, no listeners) ────────────────────

export function useSocket() {
  const socket = getSocket();

  const createRoom = (username: string, avatar: string, settings?: Record<string, unknown>) =>
    new Promise<string>((resolve, reject) => {
      socket.emit(
        'room:create',
        { username, avatar: avatar as Parameters<ClientToServerEvents['room:create']>[0]['avatar'], settings },
        (roomId) => {
          if (roomId) {
            useGameStore.setState({ playerId: socket.id ?? null, username });
            resolve(roomId);
          } else reject(new Error('Failed to create room'));
        }
      );
    });

  const joinRoom = (roomId: string, username: string, avatar: string, asSpectator = false) =>
    new Promise<void>((resolve, reject) => {
      socket.emit(
        'room:join',
        { roomId, username, avatar: avatar as Parameters<ClientToServerEvents['room:join']>[0]['avatar'], asSpectator },
        (result) => {
          if ('error' in result) reject(new Error(result.error));
          else {
            useGameStore.setState({ playerId: socket.id ?? null, username });
            resolve();
          }
        }
      );
    });

  const sendMessage = (content: string, type: 'chat' | 'accusation' | 'defense' = 'chat') => {
    socket.emit('chat:send', { content, type });
  };

  const castVote = (targetId: string) => { socket.emit('vote:cast', { targetId }); };

  const startGame = () => { socket.emit('room:start'); };

  const sendTyping = (isTyping: boolean) => { socket.emit('chat:typing', isTyping); };

  const updateSettings = (
    settings: Parameters<ClientToServerEvents['room:settings:update']>[0]['settings']
  ) => { socket.emit('room:settings:update', { settings }); };

  const addBot = (persona: 'aggressive' | 'silent_strategist' | 'chaotic_liar' = 'chaotic_liar') =>
    new Promise<string>((resolve, reject) => {
      socket.emit('room:add_bot', persona, (result) => {
        if ('error' in result) reject(new Error(result.error));
        else resolve(result.botId);
      });
    });

  const kickPlayerFromRoom = (targetId: string) => { socket.emit('room:kick', targetId); };

  const submitAnswer = (answerIndex: AnswerIndex) => {
    socket.emit('quiz:submit_answer', { answerIndex });
    useGameStore.setState({ hasSubmittedAnswer: true });
  };

  const adminAction = (
    action: 'kick' | 'ban' | 'inject_bot' | 'pause' | 'resume' | 'edit_role',
    targetId?: string,
    data?: Record<string, unknown>
  ) => { socket.emit('admin:action', { action, targetId, data }); };

  return {
    socket,
    createRoom,
    joinRoom,
    sendMessage,
    castVote,
    startGame,
    sendTyping,
    updateSettings,
    addBot,
    kickPlayerFromRoom,
    submitAnswer,
    adminAction,
  };
}
