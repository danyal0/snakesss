import React from 'react';
import { motion } from 'framer-motion';

interface CardDealProps {
  playerCount: number;
}

export function CardDeal({ playerCount }: CardDealProps) {
  const cards = Array.from({ length: playerCount });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80">
      <div className="flex flex-col items-center gap-8">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-white"
        >
          Dealing Cards...
        </motion.h2>

        <div className="relative w-48 h-64">
          {cards.map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -200, rotate: -15, opacity: 0, x: (i - playerCount / 2) * 5 }}
              animate={{ y: 0, rotate: 0, opacity: 1, x: 0 }}
              transition={{
                delay: i * 0.15,
                type: 'spring',
                stiffness: 300,
                damping: 20,
              }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
              className="w-full h-64 rounded-2xl glass-elevated border border-white/15 flex items-center justify-center"
            >
              <div className="text-6xl">🎴</div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-white/60 text-sm"
        >
          Assigning roles secretly...
        </motion.p>
      </div>
    </div>
  );
}
