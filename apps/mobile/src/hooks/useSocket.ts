import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, AvatarEmoji } from '@snakesss/shared-types';
import { useGameStore } from '../store/gameStore';
import Constants from 'expo-constants';

const SERVER_URL = (Constants.expoConfig?.extra?.['serverUrl'] as string | undefined) ?? 'http://localhost:3001';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SERVER_URL, { autoConnect: false, reconnectionAttempts: 5 });
  }
  return socket;
}

export function useSocket() {
  const socketRef = useRef<AppSocket>(getSocket());
  const store = useGameStore();

  useEffect(() => {
    const s = socketRef.current;
    s.connect();

    s.on('connect', () => store.setConnected(true, s.id));
    s.on('disconnect', () => store.setConnected(false));
    s.on('state:full', (state) => store.setGameState(state));
    s.on('state:patch', (patch) => store.patchGameState(patch));
    s.on('player:role', (role) => store.setMyRole(role));
    s.on('chat:message', (msg) => store.addMessage(msg));
    s.on('chat:typing', (ind) => store.setTyping(ind));
    s.on('vote:update', (voteCounts) => store.updateVoteTally(voteCounts));
    s.on('game:ended', (winner, _players, winnerPlayerIds) => store.setWinner(winner, winnerPlayerIds));
    s.on('phase:changed', (phase, endsAt) => store.patchGameState({ phase, phaseEndsAt: endsAt }));

    return () => {
      s.off('connect'); s.off('disconnect'); s.off('state:full');
      s.off('state:patch'); s.off('player:role'); s.off('chat:message');
      s.off('chat:typing'); s.off('vote:update'); s.off('game:ended'); s.off('phase:changed');
    };
  }, []);

  const createRoom = useCallback((username: string, avatar: AvatarEmoji) =>
    new Promise<string>((resolve, reject) => {
      socketRef.current.emit('room:create', { username, avatar }, (roomId) => {
        if (roomId) {
          useGameStore.setState({ playerId: socketRef.current.id, username });
          resolve(roomId);
        } else reject(new Error('Failed'));
      });
    }), []);

  const joinRoom = useCallback((roomId: string, username: string, avatar: AvatarEmoji, asSpectator = false) =>
    new Promise<void>((resolve, reject) => {
      socketRef.current.emit('room:join', { roomId, username, avatar, asSpectator }, (result) => {
        if ('error' in result) reject(new Error(result.error));
        else {
          useGameStore.setState({ playerId: socketRef.current.id, username });
          resolve();
        }
      });
    }), []);

  const sendMessage = useCallback((content: string, type: 'chat' | 'accusation' | 'defense' = 'chat') => {
    socketRef.current.emit('chat:send', { content, type });
  }, []);

  const castVote = useCallback((targetId: string) => {
    socketRef.current.emit('vote:cast', { targetId });
  }, []);

  const startGame = useCallback(() => socketRef.current.emit('room:start'), []);

  const sendTyping = useCallback((isTyping: boolean) => {
    socketRef.current.emit('chat:typing', isTyping);
  }, []);

  return { createRoom, joinRoom, sendMessage, castVote, startGame, sendTyping };
}
