import React from 'react';
import {
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Typography, Spacing } from '../design/tokens';

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassButton({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: GlassButtonProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 20, stiffness: 400 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const sizes = {
    sm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 4, fontSize: Typography.sizes.sm },
    md: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 4, fontSize: Typography.sizes.base },
    lg: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, fontSize: Typography.sizes.md },
  };

  const sz = sizes[size];

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={() => !disabled && !loading && onPress()}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[animStyle, fullWidth && { width: '100%' }, style]}
      >
        <LinearGradient
          colors={['#00ff88', '#00d4ff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            { paddingHorizontal: sz.paddingHorizontal, paddingVertical: sz.paddingVertical },
            fullWidth && styles.fullWidth,
            disabled && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={[styles.primaryText, { fontSize: sz.fontSize }, textStyle]}>
              {label}
            </Text>
          )}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={() => !disabled && !loading && onPress()}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        animStyle,
        styles.base,
        styles.secondary,
        { paddingHorizontal: sz.paddingHorizontal, paddingVertical: sz.paddingVertical },
        fullWidth && styles.fullWidth,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} size="small" />
      ) : (
        <Text
          style={[
            styles.secondaryText,
            { fontSize: sz.fontSize },
            variant === 'danger' && styles.dangerText,
            variant === 'ghost' && styles.ghostText,
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  danger: {
    backgroundColor: 'rgba(255,59,107,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,107,0.3)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.45 },
  primaryText: {
    color: '#000',
    fontWeight: Typography.weights.bold,
    letterSpacing: 0.2,
  },
  secondaryText: {
    color: Colors.white,
    fontWeight: Typography.weights.semibold,
  },
  dangerText: { color: '#ff3b6b' },
  ghostText: { color: Colors.textSecondary },
});
