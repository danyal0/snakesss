import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Player } from '@snakesss/shared-types';
import { AvatarDisplay } from '../ui/Avatar';

interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  voteCount?: number;
  totalVoters?: number;
  isVoteTarget?: boolean;
  canVote?: boolean;
  onVote?: (playerId: string) => void;
  showRole?: boolean;
}

export function PlayerCard({
  player,
  isMe,
  voteCount = 0,
  totalVoters = 1,
  isVoteTarget = false,
  canVote = false,
  onVote,
  showRole = false,
}: PlayerCardProps) {
  const roleColor = player.role?.type === 'snake'
    ? 'border-red-500/40 glow-snake'
    : player.role?.type === 'seer'
    ? 'border-blue-400/40 glow-seer'
    : 'border-green-400/40 glow-villager';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isVoteTarget ? 1.02 : 1,
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={clsx(
        'relative flex flex-col items-center gap-2 p-3',
        'glass rounded-2xl cursor-default',
        'transition-all duration-200',
        player.isAlive ? '' : 'opacity-40 grayscale',
        showRole && player.role?.revealed ? roleColor : '',
        canVote && player.isAlive && !isMe ? 'cursor-pointer hover:bg-white/10' : '',
        isVoteTarget ? 'ring-1 ring-red-400/50' : ''
      )}
      onClick={() => {
        if (canVote && player.isAlive && !isMe && onVote) {
          onVote(player.id);
        }
      }}
    >
      <AvatarDisplay
        emoji={player.avatar}
        size="md"
        isAlive={player.isAlive}
        isEliminated={!player.isAlive}
        isMe={isMe}
        animate={player.isAlive && !player.isSpectator}
      />

      <div className="text-center">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-white truncate max-w-[70px]">
            {player.username}
          </span>
          {player.isBot && (
            <span className="text-[10px] text-white/40 bg-white/10 rounded px-1">AI</span>
          )}
          {player.isRoomManager && (
            <span className="text-[10px]">👑</span>
          )}
        </div>

        {!player.isConnected && (
          <span className="text-[10px] text-yellow-400/70">disconnected</span>
        )}
      </div>

      {showRole && player.role?.revealed && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={clsx(
            'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
            player.role.type === 'snake' ? 'bg-red-500/30 text-red-300' :
            player.role.type === 'seer' ? 'bg-blue-500/30 text-blue-300' :
            'bg-green-500/30 text-green-300'
          )}
        >
          {player.role.type}
        </motion.div>
      )}

      {voteCount > 0 && (
        <div className="w-full">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[10px] text-white/50">votes</span>
            <span className="text-[10px] text-white/70 font-bold">{voteCount}</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(voteCount / totalVoters) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
