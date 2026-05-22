import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useSocket } from '../hooks/useSocket';
import { LobbyScreen } from './LobbyScreen';
import { GameScreen } from './GameScreen';

export function RoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) {
    return (
      <div className="h-full app-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-spin">🐍</div>
          <p className="text-white/60 text-sm">Loading room {roomId}...</p>
        </div>
      </div>
    );
  }

  if (gameState.phase === 'lobby') {
    return <LobbyScreen gameState={gameState} />;
  }

  return <GameScreen gameState={gameState} />;
}
