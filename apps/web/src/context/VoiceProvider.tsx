import React, { createContext, useContext } from 'react';
import { useVoiceChat, type VoiceMode } from '../hooks/useVoiceChat';
import { useGameStore } from '../store/gameStore';
import { isWatchOnlyGameView } from '../utils/gameViewMode';

type VoiceContextValue = ReturnType<typeof useVoiceChat>;

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const me = playerId ? gameState?.players.find((p) => p.id === playerId) : undefined;
  const watchOnly = gameState
    ? isWatchOnlyGameView(gameState, playerId, me)
    : true;
  const inRoom = !!gameState && gameState.phase !== 'ended';
  const voice = useVoiceChat(inRoom && !watchOnly);

  return <VoiceContext.Provider value={voice}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within VoiceProvider');
  return ctx;
}

export type { VoiceMode };
