import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  AnswerIndex,
  WinCondition,
  Player,
  AvatarEmoji,
} from '@snakesss/shared-types';
import { useGameStore } from '../store/gameStore';
import {
  applyRoomIdentity,
  loadSession,
  resolvePlayerId,
  saveSession,
} from './useSession';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] ?? '';

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

let _listenersRegistered = false;

export function useSocketListeners(): void {
  useEffect(() => {
    if (_listenersRegistered) return;
    _listenersRegistered = true;

    const socket = getSocket();
    socket.connect();

    socket.on('connect', () => {
      useGameStore.setState({ isConnected: true, socketId: socket.id ?? null });

      const { gameState, username } = useGameStore.getState();
      if (!gameState?.roomId || gameState.phase === 'lobby' || !username) return;

      const session = loadSession(gameState.roomId);
      if (!session) return;

      socket.emit(
        'room:join',
        {
          roomId: gameState.roomId,
          username: session.username,
          avatar: session.avatar as AvatarEmoji,
          asSpectator: false,
        },
        (result) => {
          if ('error' in result) return;
          applyRoomIdentity(
            result,
            gameState.roomId,
            session.username,
            session.avatar,
            socket.id ?? null
          );
        }
      );
    });

    socket.on('disconnect', () => {
      useGameStore.setState({ isConnected: false });
    });

    socket.on('state:full', (state) => {
      const store = useGameStore.getState();
      store.setGameState(state);
      if (store.username && !store.playerId) {
        const playerId = resolvePlayerId(state, store.username, socket.id ?? null);
        if (playerId) useGameStore.setState({ playerId });
      }
    });

    socket.on('state:patch', (patch) => {
      useGameStore.getState().patchGameState(patch);
    });

    socket.on('player:role', (role) => {
      const store = useGameStore.getState();
      const hadRole = !!store.myRole;
      store.setMyRole(role);
      if (hadRole) {
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
      useGameStore.setState({ lastSocketError: msg });
      setTimeout(() => useGameStore.setState({ lastSocketError: null }), 4000);
    });
  }, []);
}

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
            saveSession({ roomId, username, avatar, savedAt: Date.now() });
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
            applyRoomIdentity(result, roomId, username, avatar, socket.id ?? null);
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
    setTimeout(() => {
      const st = useGameStore.getState();
      if (
        st.gameState?.phase === 'question' &&
        st.playerId &&
        !(st.playerId in st.gameState.answers)
      ) {
        useGameStore.setState({ hasSubmittedAnswer: false });
      }
    }, 2000);
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
