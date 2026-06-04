import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useBlocker, useLocation, type NavigateFunction } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useGameStore } from '../store/gameStore';
import { loadUserProfile } from '../utils/userProfile';
import { useSocket } from '../hooks/useSocket';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const LEAVE_ROOM_COPY: ConfirmOptions = {
  title: 'Leave room?',
  message:
    'You will exit this game and return home. You can rejoin with the room link if the room is still open.',
  confirmLabel: 'Leave',
  cancelLabel: 'Stay',
  variant: 'danger',
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const close = useCallback((value: boolean) => {
    setPending((p) => {
      p?.resolve(value);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={!!pending}
        title={pending?.options.title ?? ''}
        message={pending?.options.message ?? ''}
        confirmLabel={pending?.options.confirmLabel}
        cancelLabel={pending?.options.cancelLabel}
        variant={pending?.options.variant}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
      <RoomLeaveBlocker confirm={confirm} />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue['confirm'] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

/** Standard copy for leaving an active room. */
export function leaveRoomConfirmOptions(): ConfirmOptions {
  return LEAVE_ROOM_COPY;
}

/** Confirm, then socket leave + navigate home. */
export function useLeaveRoom() {
  const confirm = useConfirm();
  const { leaveRoom } = useSocket();

  return useCallback(
    async (navigate: NavigateFunction) => {
      const ok = await confirm(leaveRoomConfirmOptions());
      if (!ok) return false;
      leaveRoom();
      navigate('/', { replace: true });
      return true;
    },
    [confirm, leaveRoom]
  );
}

function RoomLeaveBlocker({
  confirm,
}: {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}) {
  const location = useLocation();
  const { leaveRoom } = useSocket();
  const gameState = useGameStore((s) => s.gameState);
  const handlingRef = useRef(false);

  const inRoomRoute = location.pathname.startsWith('/room/');
  const hasActiveSession =
    !!gameState?.roomId || !!loadUserProfile()?.activeRoomId;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      import.meta.env.VITE_E2E !== 'true' &&
      inRoomRoute &&
      hasActiveSession &&
      currentLocation.pathname.startsWith('/room/') &&
      !nextLocation.pathname.startsWith('/room/')
  );

  useEffect(() => {
    if (blocker.state !== 'blocked' || handlingRef.current) return;

    handlingRef.current = true;
    void confirm(leaveRoomConfirmOptions()).then((ok) => {
      handlingRef.current = false;
      if (ok) {
        leaveRoom();
        blocker.proceed();
      } else {
        blocker.reset();
      }
    });
  }, [blocker, confirm, leaveRoom]);

  return null;
}
