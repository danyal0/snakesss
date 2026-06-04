import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Dismiss dialog"
            data-testid="confirm-dialog-backdrop"
            className="fixed inset-0 z-[200] bg-black/65 backdrop-blur-sm border-0 cursor-default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[201] flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby="confirm-dialog-message"
              data-testid="confirm-dialog"
              className="pointer-events-auto w-full max-w-sm"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <GlassCard elevated glow={variant === 'danger' ? 'red' : 'green'} className="p-6 space-y-5">
                <div className="text-center space-y-2">
                  <p className="text-3xl" aria-hidden>
                    {variant === 'danger' ? '🚪' : '❓'}
                  </p>
                  <h2
                    id="confirm-dialog-title"
                    className="text-lg font-bold text-white"
                  >
                    {title}
                  </h2>
                  <p id="confirm-dialog-message" className="text-sm text-white/55 leading-relaxed">
                    {message}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    data-testid="confirm-dialog-cancel"
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    onClick={onCancel}
                  >
                    {cancelLabel}
                  </Button>
                  <Button
                    data-testid="confirm-dialog-confirm"
                    variant={variant === 'danger' ? 'danger' : 'primary'}
                    size="md"
                    className="flex-1"
                    onClick={onConfirm}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
