import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@snakesss/shared-types';
import { useAdminStore } from '../store/adminStore';

const SERVER_URL = import.meta.env['VITE_SERVER_URL'] ?? 'http://localhost:3001';

export function useAdminSocket() {
  const token = useAdminStore((s) => s.token);
  const setAdminState = useAdminStore((s) => s.setAdminState);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io(SERVER_URL, {
      auth: { adminToken: token },
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('admin:state', (state) => {
      setAdminState(state);
    });

    socket.on('state:full', (state) => {
      useAdminStore.setState((s) => {
        if (s.selectedRoomId === state.roomId) {
          return { selectedRoomState: state };
        }
        return {};
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [token, setAdminState]);

  const adminAction = (roomId: string, action: string, targetId?: string, data?: Record<string, unknown>) => {
    socketRef.current?.emit('admin:action', {
      action: action as 'kick' | 'ban' | 'inject_bot' | 'pause' | 'resume' | 'edit_role',
      targetId,
      data: { roomId, ...data },
    });
  };

  const spectateRoom = (roomId: string) => {
    socketRef.current?.emit('spectate:room', roomId);
  };

  return { adminAction, spectateRoom };
}
