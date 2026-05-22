import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../hooks/useSocket';
import { LobbyScreen } from './LobbyScreen';
import { GameScreen } from './GameScreen';

export function RoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const gameState = useGameStore((s) => s.gameState);
  const isConnected = useGameStore((s) => s.isConnected);
  const [joinError, setJoinError] = useState('');

  // When we land on /room/:roomId but have no game state yet
  // (e.g. direct link, page refresh), spectate/re-join the room
  useEffect(() => {
    if (!roomId) return;

    // If we already have state for this room, nothing to do
    if (gameState?.roomId === roomId) return;

    if (!isConnected) return; // wait for connection

    // Try to spectate – this fetches and emits state:full back to us
    getSocket().emit('spectate:room', roomId);
  }, [roomId, gameState?.roomId, isConnected]);

  if (joinError) {
    return (
      <div className="h-full app-bg flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-5xl">😵</div>
        <p className="text-white/80 text-center">{joinError}</p>
        <button
          onClick={() => navigate('/')}
          className="glass-button rounded-xl px-6 py-3 text-white"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (!gameState || gameState.roomId !== roomId) {
    return (
      <div className="h-full app-bg flex flex-col items-center justify-center gap-4">
        <div className="relative w-16 h-16">
          <div className="text-5xl animate-pulse">🐍</div>
        </div>
        <p className="text-white/50 text-sm">Connecting to room <span className="font-mono font-bold text-white/80">{roomId}</span>…</p>
        <button
          onClick={() => navigate('/')}
          className="text-xs text-white/30 hover:text-white/60 mt-4"
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
