import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { Player, GameState } from '@snakesss/shared-types';
import { AvatarDisplay } from '../ui/Avatar';
import { Timer } from '../ui/Timer';

interface VotingPanelProps {
  gameState: GameState;
  myPlayerId: string | null;
  canVote: boolean;
  hasVoted: boolean;
  onVote: (targetId: string) => void;
}

export function VotingPanel({ gameState, myPlayerId, canVote, hasVoted, onVote }: VotingPanelProps) {
  const alivePlayers = gameState.players.filter((p) => p.isAlive && !p.isSpectator);

  // Count votes per target
  const voteCounts: Record<string, number> = {};
  Object.values(gameState.votes).forEach((targetId) => {
    voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
  });

  const myVote = myPlayerId ? gameState.votes[myPlayerId] : null;
  const totalVotes = Object.keys(gameState.votes).length;
  const totalVoters = alivePlayers.length;

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Vote to Eliminate</h3>
          <p className="text-xs text-white/50">
            {totalVotes}/{totalVoters} votes cast
          </p>
        </div>
        <Timer endsAt={gameState.phaseEndsAt} label="Time left" />
      </div>

      {/* Votes progress */}
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
          animate={{ width: `${(totalVotes / Math.max(totalVoters, 1)) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Player grid */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="grid grid-cols-3 gap-3">
          {alivePlayers.map((player) => {
            const isMe = player.id === myPlayerId;
            const voteCount = voteCounts[player.id] ?? 0;
            const isMostVoted = voteCount > 0 && voteCount === Math.max(...Object.values(voteCounts));
            const votedForThis = myVote === player.id;

            return (
              <motion.button
                key={player.id}
                whileTap={{ scale: isMe || hasVoted ? 1 : 0.95 }}
                disabled={isMe || hasVoted || !canVote}
                onClick={() => !isMe && !hasVoted && canVote && onVote(player.id)}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 rounded-2xl',
                  'transition-all duration-200',
                  isMe ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                  votedForThis ? 'bg-red-500/25 border border-red-500/40' :
                  isMostVoted ? 'bg-orange-500/15 border border-orange-500/30' :
                  'glass hover:bg-white/10',
                  hasVoted && !votedForThis && !isMe ? 'opacity-60' : ''
                )}
              >
                <AvatarDisplay emoji={player.avatar} size="sm" isAlive={player.isAlive} isMe={isMe} />

                <span className="text-xs font-medium text-white truncate w-full text-center">
                  {player.username}
                </span>

                {voteCount > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/60">{voteCount}</span>
                    <span className="text-[10px]">🗳️</span>
                  </div>
                )}

                {votedForThis && (
                  <span className="text-[10px] text-red-300 font-medium">Your vote</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {hasVoted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-3 text-center"
        >
          <p className="text-sm text-white/70">
            Vote cast for{' '}
            <span className="text-white font-semibold">
              {alivePlayers.find((p) => p.id === myVote)?.username ?? '...'}
            </span>
          </p>
          <p className="text-xs text-white/40 mt-1">Waiting for others...</p>
        </motion.div>
      )}
    </div>
  );
}
