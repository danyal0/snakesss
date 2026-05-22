import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Radius } from '../design/tokens';

interface GlassViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  elevated?: boolean;
}

export function GlassView({
  children,
  style,
  intensity = 60,
  elevated = false,
}: GlassViewProps) {
  return (
    <View style={[styles.container, elevated && styles.elevated, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.border, elevated && styles.borderElevated]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.glass,
  },
  elevated: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  borderElevated: {
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
