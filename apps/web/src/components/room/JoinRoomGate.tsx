import React, { useState } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { AvatarPicker, AvatarDisplay } from '../ui/Avatar';
import type { AvatarEmoji } from '@snakesss/shared-types';
import { loadUserProfile, saveUserProfile } from '../../utils/userProfile';
import { generateRandomUsername } from '../../utils/randomName';

interface JoinRoomGateProps {
  roomId: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  onSubmit: (username: string, avatar: AvatarEmoji) => Promise<void>;
  onCancel?: () => void;
}

export function JoinRoomGate({
  roomId,
  title = 'Join Room',
  subtitle,
  submitLabel = 'Join Room',
  onSubmit,
  onCancel,
}: JoinRoomGateProps) {
  const profile = loadUserProfile();
  const [username, setUsername] = useState(profile?.username ?? generateRandomUsername());
  const [avatar, setAvatar] = useState<AvatarEmoji>((profile?.avatar as AvatarEmoji) ?? '🦊');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username.trim()) {
      setError('Enter a username');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const name = username.trim();
      saveUserProfile({ username: name, avatar });
      await onSubmit(name, avatar);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="join-room-gate"
      className="h-full app-bg flex flex-col items-center justify-center p-6"
    >
      <GlassCard className="w-full max-w-sm p-6 space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-sm text-white/50 font-mono">{roomId}</p>
          {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <AvatarDisplay emoji={avatar} size="lg" />
          <div className="flex-1">
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>
        </div>

        <Input
          data-testid="input-username"
          label="Your Name"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <Button
          data-testid="btn-submit-join"
          variant="primary"
          size="lg"
          className="w-full"
          loading={loading}
          onClick={handleSubmit}
        >
          {submitLabel}
        </Button>

        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            data-testid="btn-join-gate-back"
            onClick={onCancel}
          >
            ← Back
          </Button>
        )}
      </GlassCard>
    </div>
  );
}
