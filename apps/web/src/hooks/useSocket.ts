import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  AnswerIndex,
  VoteChoice,
  WinCondition,
  Player,
  AvatarEmoji,
} from '@snakesss/shared-types';
import { useGameStore } from '../store/gameStore';
import {
  applyRoomIdentity,
  getRoomIdFromPath,
  loadSession,
  syncPlayerIdentityFromState,
  saveSession,
} from './useSession';
import { saveUserProfile, setActiveRoom, clearActiveRoom } from '../utils/userProfile';
import { clearSession } from './useSession';
import { syncEphemeralFromGameState } from '../store/syncEphemeralState';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] ?? '';

let _socket: AppSocket | null = null;
let _joinInFlight: string | null = null;

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

/** Re-join room from saved session so chat/votes work after refresh. */
function rejoinFromSession(socket: AppSocket, roomId: string): void {
  const session = loadSession(roomId);
  if (!session) return;
  if (_joinInFlight === roomId) return;

  _joinInFlight = roomId;
  socket.emit(
    'room:join',
    {
      roomId,
      username: session.username,
      avatar: session.avatar as AvatarEmoji,
      asSpectator: false,
      playerId: session.playerId,
    },
    (result) => {
      _joinInFlight = null;
      if ('error' in result) {
        console.warn('[Socket] rejoin failed:', result.error);
        useGameStore.getState().setLastSocketError(result.error);
        if (/room not found/i.test(result.error)) return;
        return;
      }
      applyRoomIdentity(
        result,
        roomId,
        session.username,
        session.avatar,
        socket.id ?? null
      );
    }
  );
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

      const roomId =
        useGameStore.getState().gameState?.roomId ?? getRoomIdFromPath();
      if (roomId) rejoinFromSession(socket, roomId);
    });

    socket.on('disconnect', () => {
      useGameStore.setState({ isConnected: false });
      _joinInFlight = null;
    });

    socket.on('state:full', (state) => {
      useGameStore.getState().setGameState(state);
      syncPlayerIdentityFromState(state, socket.id ?? null);
      const playerId = useGameStore.getState().playerId;
      useGameStore.setState(syncEphemeralFromGameState(state, playerId));

      const session = loadSession(state.roomId);
      if (session && !useGameStore.getState().playerId) {
        rejoinFromSession(socket, state.roomId);
      }
    });

    socket.on('state:patch', (patch) => {
      useGameStore.getState().patchGameState(patch);
    });

    socket.on('player:role', (role) => {
      useGameStore.getState().setMyRole(role, true);
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

    socket.on('vote:update', (voteCounts) => {
      useGameStore.getState().updateVoteTally(voteCounts);
    });

    socket.on('round:result', (result) => {
      useGameStore.getState().setRoundResult(result);
    });

    socket.on('game:ended', (winner: WinCondition, players: Player[], winnerPlayerIds: string[]) => {
      useGameStore.getState().setWinner(winner, winnerPlayerIds);
      useGameStore.getState().patchGameState({
        players,
        phase: 'ended',
        winner,
        winnerPlayerIds,
      });
    });

    socket.on('phase:changed', (phase, endsAt) => {
      const store = useGameStore.getState();
      store.patchGameState({ phase, phaseEndsAt: endsAt });
      if (phase === 'lobby') {
        useGameStore.setState({
          winner: null,
          winnerPlayerIds: [],
          showRoleReveal: false,
          voteTally: {},
          hasVoted: false,
          myVoteTarget: null,
          hasSubmittedAnswer: false,
        });
      }
      if (phase === 'voting') {
        store.clearVoteState();
        useGameStore.setState({ hasSubmittedAnswer: false, answerCount: 0 });
      }
      if (phase === 'question') {
        useGameStore.setState({ hasSubmittedAnswer: false });
      }
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

  const createRoom = (
    username: string,
    avatar: string,
    settings?: Record<string, unknown>,
    preferredRoomId?: string
  ) =>
    new Promise<string>((resolve, reject) => {
      socket.emit(
        'room:create',
        {
          username,
          avatar: avatar as Parameters<ClientToServerEvents['room:create']>[0]['avatar'],
          settings,
          preferredRoomId: preferredRoomId?.toUpperCase(),
        },
        (roomId) => {
          if (roomId) {
            useGameStore.setState({ playerId: socket.id ?? null, username });
            saveSession({
              roomId,
              username,
              avatar,
              playerId: socket.id ?? undefined,
              wasRoomManager: true,
              savedAt: Date.now(),
            });
            saveUserProfile({ username, avatar: avatar as AvatarEmoji, activeRoomId: roomId, wasRoomManager: true });
            resolve(roomId);
          } else reject(new Error('Failed to create room'));
        }
      );
    });

  const joinRoom = (roomId: string, username: string, avatar: string, asSpectator = false) =>
    new Promise<void>((resolve, reject) => {
      socket.emit(
        'room:join',
        { roomId, username, avatar: avatar as Parameters<ClientToServerEvents['room:join']>[0]['avatar'], asSpectator, playerId: loadSession(roomId)?.playerId },
        (result) => {
          if ('error' in result) reject(new Error(result.error));
          else {
            applyRoomIdentity(result, roomId, username, avatar, socket.id ?? null);
            const queued = result.phase !== 'lobby' && asSpectator;
            saveSession({
              roomId,
              username,
              avatar,
              playerId: useGameStore.getState().playerId ?? undefined,
              queuedForNextGame: queued,
              savedAt: Date.now(),
            });
            saveUserProfile({ username, avatar: avatar as AvatarEmoji, activeRoomId: roomId });
            setActiveRoom(roomId, { queue: queued });
            useGameStore.setState(syncEphemeralFromGameState(result, useGameStore.getState().playerId));
            resolve();
          }
        }
      );
    });

  const sendMessage = (content: string, type: 'chat' | 'accusation' | 'defense' = 'chat') => {
    socket.emit('chat:send', { content, type });
  };

  const castVote = (targetId: string) => {
    socket.emit('vote:cast', { targetId });
    useGameStore.getState().setMyVote(targetId);
  };

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

  const leaveRoom = () => {
    const roomId = useGameStore.getState().gameState?.roomId;
    socket.emit('room:leave');
    if (roomId) clearSession(roomId);
    clearActiveRoom();
    useGameStore.getState().reset();
  };

  const playAgain = () =>
    new Promise<void>((resolve, reject) => {
      const roomId = useGameStore.getState().gameState?.roomId;
      if (!roomId) {
        reject(new Error('No active room'));
        return;
      }
      socket.emit('room:play_again', (result) => {
        if (result && 'error' in result) {
          reject(new Error(result.error));
          return;
        }
        useGameStore.setState({
          winner: null,
          winnerPlayerIds: [],
          showRoleReveal: false,
          showEliminationReveal: false,
          eliminatedPlayer: null,
          voteTally: {},
          hasVoted: false,
          myVoteTarget: null,
          hasSubmittedAnswer: false,
          lastSocketError: null,
        });
        resolve();
      });
    });

  const submitAnswer = (choice: VoteChoice) => {
    const payload =
      choice === 'snake' ? { snakeVote: true } : { answerIndex: choice as AnswerIndex };
    socket.emit('quiz:submit_answer', payload);
    useGameStore.setState({ hasSubmittedAnswer: true });
    setTimeout(() => {
      const st = useGameStore.getState();
      if (
        st.gameState?.phase === 'voting' &&
        st.playerId &&
        !(st.playerId in st.gameState.answers)
      ) {
        useGameStore.setState({ hasSubmittedAnswer: false });
      }
    }, 2000);
  };

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
    leaveRoom,
    playAgain,
  };
}
