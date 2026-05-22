import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { GlassView } from '../components/GlassView';
import { GlassButton } from '../components/GlassButton';
import { Colors, Spacing, Typography, Radius } from '../design/tokens';
import { useSocket } from '../hooks/useSocket';
import { useGameStore } from '../store/gameStore';
import type { AvatarEmoji } from '@snakesss/shared-types';

const AVATARS: AvatarEmoji[] = ['🐍','🦊','🐺','🦅','🐻','🦁','🐯','🐮','🦝','🦦','🦉','🐸'];

export default function HomeScreen() {
  const router = useRouter();
  const { createRoom, joinRoom } = useSocket();
  const isConnected = useGameStore((s) => s.isConnected);

  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [avatar, setAvatar] = useState<AvatarEmoji>('🦊');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const snakeRotate = useSharedValue(0);
  React.useEffect(() => {
    snakeRotate.value = withRepeat(
      withSequence(withTiming(-8, { duration: 1000 }), withTiming(8, { duration: 1000 })),
      -1,
      true
    );
  }, []);

  const snakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${snakeRotate.value}deg` }],
  }));

  const handleCreate = async () => {
    if (!username.trim()) { setError('Enter a username'); return; }
    setLoading(true); setError('');
    try {
      const roomId = await createRoom(username.trim(), avatar);
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!username.trim() || !roomCode.trim()) { setError('Fill all fields'); return; }
    setLoading(true); setError('');
    try {
      await joinRoom(roomCode.trim().toUpperCase(), username.trim(), avatar);
      router.push(`/room/${roomCode.trim().toUpperCase()}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.logo}>
            <Animated.Text style={[styles.logoEmoji, snakeStyle]}>🐍</Animated.Text>
            <Text style={styles.title}>Snakesss</Text>
            <Text style={styles.subtitle}>Social Deduction · Bluff · Survive</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: isConnected ? Colors.primary : Colors.warn }]} />
              <Text style={styles.statusText}>{isConnected ? 'Connected' : 'Connecting...'}</Text>
            </View>
          </Animated.View>

          {mode === 'home' && (
            <Animated.View entering={FadeInUp.delay(200)} style={styles.actions}>
              <GlassButton
                label="Create Room"
                onPress={() => setMode('create')}
                variant="primary"
                size="lg"
                fullWidth
                disabled={!isConnected}
              />
              <GlassButton
                label="Join Room"
                onPress={() => setMode('join')}
                variant="secondary"
                size="lg"
                fullWidth
                disabled={!isConnected}
              />
            </Animated.View>
          )}

          {(mode === 'create' || mode === 'join') && (
            <Animated.View entering={FadeInUp} style={styles.formContainer}>
              <GlassView style={styles.form}>
                <Text style={styles.formTitle}>
                  {mode === 'create' ? 'Create Room' : 'Join Room'}
                </Text>

                {/* Avatar picker */}
                <Text style={styles.label}>Choose Avatar</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.avatarScroll}
                  contentContainerStyle={styles.avatarContainer}
                >
                  {AVATARS.map((emoji) => (
                    <GlassButton
                      key={emoji}
                      label={emoji}
                      onPress={() => setAvatar(emoji)}
                      variant={avatar === emoji ? 'primary' : 'ghost'}
                      size="sm"
                      style={styles.avatarBtn}
                    />
                  ))}
                </ScrollView>

                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter username"
                  placeholderTextColor={Colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  maxLength={20}
                  autoCapitalize="none"
                  returnKeyType="done"
                />

                {mode === 'join' && (
                  <>
                    <Text style={styles.label}>Room Code</Text>
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      placeholder="ABC123"
                      placeholderTextColor={Colors.textMuted}
                      value={roomCode}
                      onChangeText={(t) => setRoomCode(t.toUpperCase())}
                      maxLength={6}
                      autoCapitalize="characters"
                      returnKeyType="join"
                    />
                  </>
                )}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <GlassButton
                  label={mode === 'create' ? 'Create Room' : 'Join Room'}
                  onPress={mode === 'create' ? handleCreate : handleJoin}
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={loading}
                  style={{ marginTop: Spacing.sm }}
                />

                <GlassButton
                  label="← Back"
                  onPress={() => { setMode('home'); setError(''); }}
                  variant="ghost"
                  size="sm"
                  style={{ marginTop: Spacing.xs }}
                />
              </GlassView>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: Spacing.lg, paddingTop: Spacing.xxl },
  logo: { alignItems: 'center', marginBottom: Spacing.xl },
  logoEmoji: { fontSize: 80, marginBottom: Spacing.md },
  title: {
    fontSize: Typography.sizes.hero,
    fontWeight: Typography.weights.black,
    color: Colors.white,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: Typography.sizes.xs, color: Colors.textMuted },
  actions: { gap: Spacing.sm },
  formContainer: { marginTop: Spacing.md },
  form: { padding: Spacing.lg, gap: Spacing.sm },
  formTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    color: Colors.white,
    fontSize: Typography.sizes.base,
  },
  codeInput: {
    textTransform: 'uppercase',
    letterSpacing: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: Typography.weights.bold,
  },
  avatarScroll: { marginBottom: Spacing.xs },
  avatarContainer: { gap: 8, paddingVertical: 4 },
  avatarBtn: { width: 44, height: 44 },
  error: { color: Colors.danger, fontSize: Typography.sizes.sm, textAlign: 'center' },
});
