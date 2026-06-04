import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { triggerHaptic, type HapticKind } from '../../utils/haptics';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  haptic?: HapticKind;
  children: React.ReactNode;
}

function hapticForVariant(variant: ButtonProps['variant'], haptic: HapticKind): HapticKind {
  if (variant === 'danger') return 'warning';
  if (variant === 'primary') return 'confirm';
  return haptic;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  haptic = 'tap',
  children,
  className,
  disabled,
  onClick,
  onPointerDown,
  ...props
}: ButtonProps) {
  const fireHaptic = () => {
    if (disabled || loading) return;
    triggerHaptic(hapticForVariant(variant, haptic));
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={clsx(
        'relative inline-flex items-center justify-center gap-2 font-semibold',
        'rounded-xl no-tap gpu',
        size === 'sm' && 'px-4 py-2 text-sm',
        size === 'md' && 'px-6 py-3 text-base',
        size === 'lg' && 'px-8 py-4 text-lg',
        variant === 'primary' && 'btn-primary',
        variant === 'secondary' && 'glass-button text-white',
        variant === 'danger' && 'btn-danger',
        variant === 'ghost' && 'text-white/70 hover:text-white hover:bg-white/5 transition-colors',
        (disabled || loading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || loading}
      onPointerDown={(e) => {
        fireHaptic();
        onPointerDown?.(e);
      }}
      onClick={(e) => {
        onClick?.(e);
      }}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </motion.button>
  );
}
