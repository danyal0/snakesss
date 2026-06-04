import React from 'react';
import clsx from 'clsx';
import type { AvatarEmoji } from '@snakesss/shared-types';
import { AvatarDisplay } from './Avatar';
import { useVoice } from '../../context/VoiceProvider';
import { triggerHaptic } from '../../utils/haptics';

interface PlayerAvatarProps {
  emoji: AvatarEmoji;
  playerId: string;
  size?: 'sm' | 'md';
  isMe?: boolean;
  isAlive?: boolean;
  isEliminated?: boolean;
  showMic?: boolean;
  /** Covert fellow-snake marker (no text labels). */
  covertAlly?: boolean;
  voteBadge?: number;
  answered?: boolean;
  accent?: 'green' | 'red' | 'amber';
}

const sizeOuter = { sm: 'w-11 h-11', md: 'w-12 h-12' };

export function PlayerAvatar({
  emoji,
  playerId,
  size = 'sm',
  isMe = false,
  isAlive = true,
  isEliminated = false,
  showMic = false,
  covertAlly = false,
  voteBadge,
  answered,
  accent = 'green',
}: PlayerAvatarProps) {
  const voice = useVoice();
  const level = voice.speakingLevels[playerId] ?? 0;
  const speaking = level > 0.06;
  const ringScale = 1 + Math.min(0.12, level * 0.18);
  const accentColor =
    accent === 'red'
      ? 'rgba(255, 90, 120, 0.85)'
      : accent === 'amber'
        ? 'rgba(255, 184, 0, 0.85)'
        : 'rgba(0, 255, 136, 0.85)';

  return (
    <div className="relative flex flex-col items-center" data-player-id={playerId}>
      <div
        className={clsx('relative flex items-center justify-center', sizeOuter[size])}
        style={{ padding: speaking ? 3 : 0 }}
      >
        {speaking && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none gpu"
            style={{
              boxShadow: `0 0 ${8 + level * 20}px ${accentColor}`,
              transform: `scale(${ringScale})`,
              opacity: 0.35 + level * 0.55,
              transition: 'transform 80ms linear, opacity 80ms linear',
            }}
            data-testid={`speaking-ring-${playerId}`}
          />
        )}

        <AvatarDisplay
          emoji={emoji}
          size={size === 'sm' ? 'sm' : 'md'}
          isAlive={isAlive}
          isEliminated={isEliminated}
          isMe={isMe}
          className={clsx(
            isEliminated && 'grayscale',
            covertAlly && 'ring-1 ring-red-400/25 bg-red-500/5'
          )}
        />

        {covertAlly && isAlive && (
          <span
            className="absolute -top-0.5 -left-0.5 text-[9px] opacity-55 select-none pointer-events-none"
            aria-hidden
            data-testid={`covert-snake-${playerId}`}
          >
            🐍
          </span>
        )}

        {voteBadge != null && voteBadge > 0 && isAlive && (
          <div className="absolute top-0 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 shadow-lg">
            {voteBadge}
          </div>
        )}

        {answered && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow">
            ✓
          </div>
        )}

        {showMic && isMe && (
          <button
            type="button"
            data-testid="btn-voice-mic"
            aria-label={voice.micEnabled ? (voice.micMuted ? 'Unmute microphone' : 'Mute microphone') : 'Enable microphone'}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('toggle');
              void voice.toggleMic();
            }}
            onPointerDown={(e) => {
              if (voice.voiceMode === 'push' && voice.micEnabled) {
                e.stopPropagation();
                voice.setPushToTalkHeld(true);
              }
            }}
            onPointerUp={() => {
              if (voice.voiceMode === 'push') voice.setPushToTalkHeld(false);
            }}
            onPointerLeave={() => {
              if (voice.voiceMode === 'push') voice.setPushToTalkHeld(false);
            }}
            className={clsx(
              'absolute -bottom-1 -left-1 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] shadow-md transition-colors',
              voice.micEnabled && !voice.micMuted
                ? 'bg-green-500/90 border-green-300/50 text-black'
                : voice.permissionDenied
                  ? 'bg-amber-500/80 border-amber-300/40 text-black'
                  : 'bg-white/15 border-white/25 text-white/80'
            )}
          >
            {voice.permissionDenied ? '!' : voice.micEnabled && !voice.micMuted ? '🎙' : '🔇'}
          </button>
        )}
      </div>

      {/* Hidden audio sink for remote peer tracks */}
      <audio id={`voice-audio-${playerId}`} autoPlay playsInline className="hidden" />
    </div>
  );
}
