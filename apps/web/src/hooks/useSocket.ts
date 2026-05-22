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
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const socketRef = useRef<AppSocket>(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    socket.connect();

    const onConnect = () => {
      useGameStore.setState({ isConnected: true, socketId: socket.id ?? null });
    };

    const onDisconnect = () => {
      useGameStore.setState({ isConnected: false });
    };

    const onStateFull = (state: Parameters<ServerToClientEvents['state:full']>[0]) => {
      useGameStore.getState().setGameState(state);
    };

    const onStatePatch = (patch: Parameters<ServerToClientEvents['state:patch']>[0]) => {
      useGameStore.getState().patchGameState(patch);
    };

    const onPlayerRole = (role: Parameters<ServerToClientEvents['player:role']>[0]) => {
      useGameStore.getState().setMyRole(role);
    };

    const onChatMessage = (message: Parameters<ServerToClientEvents['chat:message']>[0]) => {
      useGameStore.getState().addMessage(message);
    };

    const onChatTyping = (indicator: Parameters<ServerToClientEvents['chat:typing']>[0]) => {
      useGameStore.getState().setTyping(indicator);
    };

    const onVoteUpdate = (votes: Parameters<ServerToClientEvents['vote:update']>[0]) => {
      useGameStore.getState().updateVotes(votes);
    };

    const onRoundResult = (result: Parameters<ServerToClientEvents['round:result']>[0]) => {
      useGameStore.getState().setRoundResult(result);
    };

    const onGameEnded = (winner: Parameters<ServerToClientEvents['game:ended']>[0]) => {
      useGameStore.getState().setWinner(winner);
    };

    const onPhaseChanged = (
      phase: Parameters<ServerToClientEvents['phase:changed']>[0],
      endsAt: Parameters<ServerToClientEvents['phase:changed']>[1]
    ) => {
      const gs = useGameStore.getState().gameState;
      // If phase is 'elimination', show the eliminated player overlay
      if (phase === 'elimination' && gs) {
        const justEliminated = gs.players.find((p) => !p.isAlive);
        if (justEliminated) {
          useGameStore.getState().setShowElimination(true, justEliminated);
          setTimeout(() => useGameStore.getState().setShowElimination(false), 3500);
        }
      }
      useGameStore.getState().patchGameState({ phase, phaseEndsAt: endsAt });
    };

    const onPlayerJoined = (player: Parameters<ServerToClientEvents['player:joined']>[0]) => {
      const current = useGameStore.getState().gameState;
      if (!current) return;
      // Avoid duplicates
      if (current.players.some((p) => p.id === player.id)) return;
      useGameStore.getState().setGameState({
        ...current,
        players: [...current.players, player],
      });
    };

    const onPlayerLeft = (playerId: Parameters<ServerToClientEvents['player:left']>[0]) => {
      const current = useGameStore.getState().gameState;
      if (!current) return;
      useGameStore.getState().patchGameState({
        players: current.players.map((p) =>
          p.id === playerId ? { ...p, isConnected: false } : p
        ),
      });
    };

    const onError = (msg: string) => {
      console.error('[Socket error]', msg);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state:full', onStateFull);
    socket.on('state:patch', onStatePatch);
    socket.on('player:role', onPlayerRole);
    socket.on('chat:message', onChatMessage);
    socket.on('chat:typing', onChatTyping);
    socket.on('vote:update', onVoteUpdate);
    socket.on('round:result', onRoundResult);
    socket.on('game:ended', onGameEnded);
    socket.on('phase:changed', onPhaseChanged);
    socket.on('player:joined', onPlayerJoined);
    socket.on('player:left', onPlayerLeft);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state:full', onStateFull);
      socket.off('state:patch', onStatePatch);
      socket.off('player:role', onPlayerRole);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:typing', onChatTyping);
      socket.off('vote:update', onVoteUpdate);
      socket.off('round:result', onRoundResult);
      socket.off('game:ended', onGameEnded);
      socket.off('phase:changed', onPhaseChanged);
      socket.off('player:joined', onPlayerJoined);
      socket.off('player:left', onPlayerLeft);
      socket.off('error', onError);
    };
  }, []);

  const createRoom = useCallback(
    (username: string, avatar: string, settings?: Record<string, unknown>) => {
      return new Promise<string>((resolve, reject) => {
        const socket = socketRef.current;
        socket.emit(
          'room:create',
          {
            username,
            avatar: avatar as Parameters<ClientToServerEvents['room:create']>[0]['avatar'],
            settings,
          },
          (roomId) => {
            if (roomId) {
              useGameStore.setState({ playerId: socket.id ?? null, username });
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
        const socket = socketRef.current;
        socket.emit(
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
              useGameStore.setState({ playerId: socket.id ?? null, username });
              resolve();
            }
          }
        );
      });
    },
    []
  );

  const sendMessage = useCallback(
    (content: string, type: 'chat' | 'accusation' | 'defense' = 'chat') => {
      socketRef.current.emit('chat:send', { content, type });
    },
    []
  );

  const castVote = useCallback((targetId: string) => {
    socketRef.current.emit('vote:cast', { targetId });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current.emit('room:start');
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    socketRef.current.emit('chat:typing', isTyping);
  }, []);

  const updateSettings = useCallback(
    (settings: Parameters<ClientToServerEvents['room:settings:update']>[0]['settings']) => {
      socketRef.current.emit('room:settings:update', { settings });
    },
    []
  );

  const addBot = useCallback(
    (persona: 'aggressive' | 'silent_strategist' | 'chaotic_liar' = 'chaotic_liar') => {
      return new Promise<string>((resolve, reject) => {
        socketRef.current.emit('room:add_bot', persona, (result) => {
          if ('error' in result) reject(new Error(result.error));
          else resolve(result.botId);
        });
      });
    },
    []
  );

  const kickPlayerFromRoom = useCallback((targetId: string) => {
    socketRef.current.emit('room:kick', targetId);
  }, []);

  const adminAction = useCallback(
    (
      action: 'kick' | 'ban' | 'inject_bot' | 'pause' | 'resume' | 'edit_role',
      targetId?: string,
      data?: Record<string, unknown>
    ) => {
      socketRef.current.emit('admin:action', { action, targetId, data });
    },
    []
  );

  return {
    socket: socketRef.current,
    createRoom,
    joinRoom,
    sendMessage,
    castVote,
    startGame,
    sendTyping,
    updateSettings,
    adminAction,
    addBot,
    kickPlayerFromRoom,
  };
}
