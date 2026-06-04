import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AvatarPicker, AvatarDisplay } from '../components/ui/Avatar';
import type { AvatarEmoji } from '@snakesss/shared-types';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';
import { LeaderboardWidget } from '../components/ui/LeaderboardWidget';
import { loadSession } from '../hooks/useSession';
import { loadUserProfile, saveUserProfile } from '../utils/userProfile';
import { generateRandomUsername } from '../utils/randomName';
import { triggerHaptic } from '../utils/haptics';

export function HomeScreen() {
  const navigate = useNavigate();
  const { createRoom, joinRoom } = useSocket();
  const resetStore = useGameStore((s) => s.reset);
  const isConnected = useGameStore((s) => s.isConnected);

  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [avatar, setAvatar] = useState<AvatarEmoji>('🦊');
  const [asSpectator, setAsSpectator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const profile = loadUserProfile();
    if (profile) {
      setUsername(profile.username);
      setAvatar(profile.avatar as AvatarEmoji);
    } else {
      setUsername(generateRandomUsername());
    }

    const activeRoom = profile?.activeRoomId;
    if (
      import.meta.env.VITE_E2E !== 'true' &&
      activeRoom &&
      loadSession(activeRoom)
    ) {
      navigate(`/room/${activeRoom}`, { replace: true });
      return;
    }

    resetStore();
  }, [navigate, resetStore]);

  const persistProfile = (name: string, av: AvatarEmoji) => {
    saveUserProfile({ username: name, avatar: av });
  };

  const handleCreate = async () => {
    if (!username.trim()) { setError('Enter a username'); return; }
    setLoading(true);
    setError('');
    try {
      const name = username.trim();
      persistProfile(name, avatar);
      const roomId = await createRoom(name, avatar);
      navigate(`/room/${roomId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!username.trim()) { setError('Enter a username'); return; }
    if (!roomCode.trim()) { setError('Enter a room code'); return; }
    setLoading(true);
    setError('');
    try {
      const name = username.trim();
      const code = roomCode.trim().toUpperCase();
      persistProfile(name, avatar);
      await joinRoom(code, name, avatar, asSpectator);
      navigate(`/room/${code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="home-screen" className="h-full app-bg flex flex-col items-center justify-center p-6 overflow-y-auto scrollbar-none">
      {import.meta.env.VITE_E2E !== 'true' && (
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {['🐍', '🦊', '🐺', '🦅', '🐻'].map((emoji, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl opacity-5"
            style={{
              left: `${15 + i * 18}%`,
              top: `${10 + Math.sin(i) * 30}%`,
            }}
            animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.7 }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>
      )}

      <div className="w-full max-w-sm space-y-6 relative">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="text-7xl"
          >
            🐍
          </motion.div>
          <h1 className="text-5xl font-black text-white tracking-tight">
            Snakesss
          </h1>
          <p className="text-white/50 text-sm">Social Deduction · Bluff · Survive</p>

          {!isConnected && (
            <div className="flex items-center gap-1.5 justify-center">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-xs text-yellow-400/80">Connecting...</span>
            </div>
          )}
          {isConnected && (
            <div className="flex items-center gap-1.5 justify-center">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-xs text-green-400/80">Connected</span>
            </div>
          )}
        </motion.div>

        {mode === 'home' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <Button
              data-testid="btn-create-room"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setMode('create')}
              disabled={!isConnected}
            >
              Create Room
            </Button>
            <Button
              data-testid="btn-join-room"
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => setMode('join')}
              disabled={!isConnected}
            >
              Join Room
            </Button>
            <Button
              data-testid="btn-browse-rooms"
              variant="ghost"
              size="md"
              className="w-full"
              onClick={() => navigate('/rooms')}
            >
              Browse Public Rooms
            </Button>
            <Button
              data-testid="btn-leaderboard"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => navigate('/leaderboard')}
            >
              🏆 Leaderboard
            </Button>
          <LeaderboardWidget />
          </motion.div>
        )}

        {(mode === 'create' || mode === 'join') && (
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <GlassCard data-testid={mode === 'create' ? 'create-room-form' : 'join-room-form'} className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {mode === 'create' ? 'Create Room' : 'Join Room'}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => { setMode('home'); setError(''); }}>
                  ← Back
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Choose Avatar</label>
                <div className="flex items-center gap-3">
                  <AvatarDisplay emoji={avatar} size="lg" />
                  <div className="flex-1">
                    <AvatarPicker value={avatar} onChange={setAvatar} />
                  </div>
                </div>
              </div>

              <Input
                data-testid="input-username"
                label="Your Name"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                onKeyDown={(e) => e.key === 'Enter' && (mode === 'create' ? handleCreate() : handleJoin())}
              />

              {mode === 'join' && (
                <>
                  <Input
                    data-testid="input-room-code"
                    label="Room Code"
                    placeholder="e.g. AB12"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                    maxLength={4}
                    className="uppercase tracking-widest font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  />

                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      className={`w-10 h-6 rounded-full transition-colors ${asSpectator ? 'bg-green-500' : 'bg-white/20'} relative`}
                      onClick={() => {
                        triggerHaptic('toggle');
                        setAsSpectator(!asSpectator);
                      }}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${asSpectator ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                    <span className="text-sm text-white/70">Join as Spectator</span>
                  </label>
                </>
              )}

              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <Button
                data-testid="btn-submit-room"
                variant="primary"
                size="lg"
                className="w-full"
                loading={loading}
                onClick={mode === 'create' ? handleCreate : handleJoin}
              >
                {mode === 'create' ? 'Create Room' : 'Join Room'}
              </Button>
            </GlassCard>
          </motion.div>
        )}

        <div className="text-center">
          <p className="text-xs text-white/20">
            Share 4-letter room codes with friends · AI bots available
          </p>
        </div>
      </div>
    </div>
  );
}
