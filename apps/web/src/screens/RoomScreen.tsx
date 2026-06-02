import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../hooks/useSocket';
import {
  loadSession,
  clearSession,
  applyRoomIdentity,
  isRegisteredPlayer,
} from '../hooks/useSession';
import type { AvatarEmoji } from '@snakesss/shared-types';
import { LobbyScreen } from './LobbyScreen';
import { GameScreen } from './GameScreen';

export function RoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const gameState = useGameStore((s) => s.gameState);
  const isConnected = useGameStore((s) => s.isConnected);
  const playerId = useGameStore((s) => s.playerId);
  const [joinError, setJoinError] = useState('');
  const spectateAttempted = useRef(false);

  useEffect(() => {
    if (!roomId || !isConnected) return;

    const session = loadSession(roomId);
    const registered =
      gameState?.roomId === roomId && isRegisteredPlayer(gameState, playerId);

    if (registered) return;

    const socket = getSocket();

    if (session) {
      socket.emit(
        'room:join',
        {
          roomId,
          username: session.username,
          avatar: session.avatar as AvatarEmoji,
          asSpectator: false,
        },
        (result) => {
          if ('error' in result) {
            clearSession(roomId);
            setJoinError(result.error);
          } else {
            applyRoomIdentity(
              result,
              roomId,
              session.username,
              session.avatar,
              socket.id ?? null
            );
          }
        }
      );
      return;
    }

    if (!spectateAttempted.current) {
      spectateAttempted.current = true;
      socket.emit('spectate:room', roomId);
    }
  }, [roomId, isConnected, gameState?.roomId, playerId]);

  if (joinError) {
    return (
      <div data-testid="room-error" className="h-full app-bg flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-5xl">🚫</div>
        <div className="text-center space-y-1">
          <p className="text-white font-semibold">Could not rejoin room</p>
          <p className="text-white/50 text-sm">{joinError}</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="glass-button rounded-xl px-6 py-3 text-white text-sm"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  if (!gameState || gameState.roomId !== roomId) {
    return (
      <div data-testid="room-loading" className="h-full app-bg flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>🐍</div>
        <p className="text-white/60 text-sm text-center">
          Connecting to room{' '}
          <span className="font-mono font-bold text-white/80">{roomId}</span>…
        </p>
        <p className="text-xs text-white/25">
          {roomId && loadSession(roomId) ? 'Restoring your session…' : 'Getting room state…'}
        </p>
        {!loadSession(roomId ?? '') && (
          <p className="text-xs text-amber-400/80 text-center max-w-xs">
            No saved session — chat and votes only work if you re-join from home with the same name.
          </p>
        )}
        <button
          onClick={() => navigate('/')}
          className="text-xs text-white/30 hover:text-white/60 mt-4 transition-colors"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  if (gameState.phase === 'lobby') {
    return <LobbyScreen gameState={gameState} />;
  }

  return <GameScreen gameState={gameState} />;
}
