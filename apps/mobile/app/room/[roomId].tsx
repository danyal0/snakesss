import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../src/store/gameStore';
import { Colors } from '../../src/design/tokens';

export default function RoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const gameState = useGameStore((s) => s.gameState);

  if (!gameState) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <Text style={styles.loadingEmoji}>🐍</Text>
          <Text style={styles.loadingText}>Joining {roomId}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Phase-based rendering - simplified for mobile
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.roomId}>{gameState.roomId}</Text>
        <Text style={styles.phase}>Phase: {gameState.phase}</Text>
        <Text style={styles.players}>
          {gameState.players.filter((p) => !p.isSpectator).length} players
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingEmoji: { fontSize: 64 },
  loadingText: { color: Colors.textSecondary, fontSize: 16 },
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  roomId: { fontSize: 48, fontWeight: '900', color: Colors.white, letterSpacing: 4 },
  phase: { fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  players: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
});
