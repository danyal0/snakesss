import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@snakesss/shared-types';
import { useGameStore } from '../store/gameStore';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] ?? '';

let socketInstance: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socketInstance) {
    socketInstance = io(SERVER_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const socketRef = useRef<AppSocket>(getSocket());
  const store = useGameStore();

  useEffect(() => {
    const socket = socketRef.current;

    socket.connect();

    socket.on('connect', () => {
      store.setConnected(true, socket.id);
    });

    socket.on('disconnect', () => {
      store.setConnected(false);
    });

    socket.on('state:full', (state) => {
      store.setGameState(state);
    });

    socket.on('state:patch', (patch) => {
      store.patchGameState(patch);
    });

    socket.on('player:role', (role) => {
      store.setMyRole(role);
    });

    socket.on('chat:message', (message) => {
      store.addMessage(message);
    });

    socket.on('chat:typing', (indicator) => {
      store.setTyping(indicator);
    });

    socket.on('vote:update', (votes) => {
      store.updateVotes(votes);
    });

    socket.on('round:result', (result) => {
      store.setRoundResult(result);
    });

    socket.on('game:ended', (winner) => {
      store.setWinner(winner);
    });

    socket.on('phase:changed', (phase, endsAt) => {
      store.patchGameState({ phase, phaseEndsAt: endsAt });
    });

    socket.on('player:joined', (player) => {
      store.setGameState({
        ...store.gameState!,
        players: [...(store.gameState?.players ?? []), player],
      });
    });

    socket.on('player:left', (playerId) => {
      store.patchGameState({
        players: store.gameState?.players.filter((p) => p.id !== playerId),
      });
    });

    socket.on('error', (msg) => {
      console.error('[Socket error]', msg);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('state:full');
      socket.off('state:patch');
      socket.off('player:role');
      socket.off('chat:message');
      socket.off('chat:typing');
      socket.off('vote:update');
      socket.off('round:result');
      socket.off('game:ended');
      socket.off('phase:changed');
      socket.off('player:joined');
      socket.off('player:left');
      socket.off('error');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = useCallback(
    (username: string, avatar: string, settings?: Record<string, unknown>) => {
      return new Promise<string>((resolve, reject) => {
        socketRef.current.emit(
          'room:create',
          { username, avatar: avatar as Parameters<ClientToServerEvents['room:create']>[0]['avatar'], settings },
          (roomId) => {
            if (roomId) {
              useGameStore.setState({ playerId: socketRef.current.id, username });
              resolve(roomId);
            } else {
              reject(new Error('Failed to create room'));
            }
          }
        );
      });
    },
    []
  );

  const joinRoom = useCallback(
    (roomId: string, username: string, avatar: string, asSpectator = false) => {
      return new Promise<void>((resolve, reject) => {
        socketRef.current.emit(
          'room:join',
          {
            roomId,
            username,
            avatar: avatar as Parameters<ClientToServerEvents['room:join']>[0]['avatar'],
            asSpectator,
          },
          (result) => {
            if ('error' in result) {
              reject(new Error(result.error));
            } else {
              useGameStore.setState({ playerId: socketRef.current.id, username });
              resolve();
            }
          }
        );
      });
    },
    []
  );

  const sendMessage = useCallback((content: string, type: 'chat' | 'accusation' | 'defense' = 'chat') => {
    socketRef.current.emit('chat:send', { content, type });
  }, []);

  const castVote = useCallback((targetId: string) => {
    socketRef.current.emit('vote:cast', { targetId });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current.emit('room:start');
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    socketRef.current.emit('chat:typing', isTyping);
  }, []);

  const updateSettings = useCallback((settings: Parameters<ClientToServerEvents['room:settings:update']>[0]['settings']) => {
    socketRef.current.emit('room:settings:update', { settings });
  }, []);

  return {
    socket: socketRef.current,
    createRoom,
    joinRoom,
    sendMessage,
    castVote,
    startGame,
    sendTyping,
    updateSettings,
  };
}
