import React from 'react';
import { motion } from 'framer-motion';
import type { GameState } from '@snakesss/shared-types';

interface SpectatorPhasePanelProps {
  gameState: GameState;
  voteCounts: Record<string, number>;
  variant: 'eliminated' | 'spectator';
}

export function SpectatorPhasePanel({
  gameState,
  voteCounts,
  variant,
}: SpectatorPhasePanelProps) {
  const alivePlayers = gameState.players.filter((p) => p.isAlive && !p.isSpectator);
  const maxVotes = Math.max(...Object.values(voteCounts), 0);
  const answered =
    gameState.answeredPlayerIds?.length ??
    Object.keys(gameState.answers ?? {}).length;

  const phaseCopy: Record<string, { title: string; subtitle: string }> = {
    voting: {
      title: 'Players are locking answers',
      subtitle: 'Watch live progress — you cannot vote',
    },
    vote_reveal: {
      title: 'Vote results',
      subtitle: 'Tally is being revealed',
    },
    elimination: {
      title: 'Elimination',
      subtitle: 'See who leaves the game',
    },
    dealing: {
      title: 'Dealing roles',
      subtitle: 'New round starting',
    },
  };

  const copy = phaseCopy[gameState.phase] ?? {
    title: variant === 'eliminated' ? "You've been eliminated" : 'Spectating',
    subtitle: 'Follow the match from the Question and Chat tabs',
  };

  return (
    <div
      data-testid="spectator-phase-panel"
      className="h-full flex flex-col items-center justify-center p-6 gap-5 text-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="text-6xl">{variant === 'eliminated' ? '💀' : '👁️'}</div>
        <div>
          <p className="text-white font-bold text-lg">{copy.title}</p>
          <p className="text-white/50 text-sm mt-1">{copy.subtitle}</p>
        </div>
      </motion.div>

      {gameState.phase === 'voting' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full glass rounded-2xl p-4 space-y-3"
        >
          <p className="text-[10px] text-white/30 uppercase tracking-wider">
            Answers locked · {answered}/{alivePlayers.length || answered}
          </p>
          {alivePlayers.length > 0 && maxVotes > 0 ? (
            <div className="space-y-2.5">
              {alivePlayers
                .sort((a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0))
                .map((player) => {
                  const count = voteCounts[player.id] ?? 0;
                  return (
                    <div key={player.id} className="flex items-center gap-2.5">
                      <span className="text-base">{player.avatar}</span>
                      <span className="text-xs text-white/70 flex-1 text-left">
                        {player.username}
                      </span>
                      {count > 0 ? (
                        <>
                          <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden max-w-[120px]">
                            <motion.div
                              className="h-full bg-red-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{
                                width: `${maxVotes > 0 ? (count / maxVotes) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold text-red-400 w-4 text-right">
                            {count}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] text-white/25">—</span>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-xs text-white/40">Waiting for players…</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
