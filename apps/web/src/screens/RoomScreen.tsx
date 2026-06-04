import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { getSocket, useSocket } from '../hooks/useSocket';
import {
  loadSession,
  clearSession,
  saveSession,
  isRegisteredPlayer,
} from '../hooks/useSession';
import type { AvatarEmoji } from '@snakesss/shared-types';
import { LobbyScreen } from './LobbyScreen';
import { GameScreen } from './GameScreen';
import { JoinRoomGate } from '../components/room/JoinRoomGate';
import {
  loadUserProfile,
  saveUserProfile,
  setActiveRoom,
  clearActiveRoom,
} from '../utils/userProfile';
import { abandonRoom } from '../utils/abandonRoom';
import { useConfirmLeaveHome } from '../hooks/useLeaveRoom';

const ROOM_JOIN_TIMEOUT_MS = 6000;

type RoomIntent = 'join' | 'spectate' | 'invite';

export function RoomScreen() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { joinRoom, createRoom } = useSocket();
  const confirmLeaveHome = useConfirmLeaveHome();
  const gameState = useGameStore((s) => s.gameState);
  const isConnected = useGameStore((s) => s.isConnected);
  const playerId = useGameStore((s) => s.playerId);
  const lastSocketError = useGameStore((s) => s.lastSocketError);
  const [joinError, setJoinError] = useState('');
  const [needsJoinForm, setNeedsJoinForm] = useState(false);
  const [queueNotice, setQueueNotice] = useState(false);
  const spectateAttempted = useRef(false);
  const recreateAttempted = useRef(false);
  const autoJoinAttempted = useRef(false);

  const code = roomId?.toUpperCase() ?? '';
  const session = code ? loadSession(code) : null;
  const profile = loadUserProfile();
  const intent: RoomIntent =
    (location.state as { roomIntent?: RoomIntent } | null)?.roomIntent ??
    (session || profile?.username ? 'invite' : 'join');

  const registered =
    !!gameState &&
    gameState.roomId === code &&
    isRegisteredPlayer(gameState, playerId);

  const me = playerId ? gameState?.players.find((p) => p.id === playerId) : undefined;
  const isSpectator = me?.isSpectator ?? false;

  const tryRecreateRoom = useCallback(async () => {
    if (!code || recreateAttempted.current) return false;
    const sess = loadSession(code);
    if (!sess?.wasRoomManager) return false;
    recreateAttempted.current = true;
    try {
      const newId = await createRoom(sess.username, sess.avatar as AvatarEmoji, undefined, code);
      if (newId !== code) {
        clearSession(code);
        navigate(`/room/${newId}`, { replace: true });
      }
      return true;
    } catch {
      recreateAttempted.current = false;
      return false;
    }
  }, [code, createRoom, navigate]);

  const performJoin = useCallback(
    async (username: string, avatar: AvatarEmoji, asSpectator: boolean) => {
      if (!code) return;
      setJoinError('');
      try {
        await joinRoom(code, username, avatar, asSpectator);
        const st = useGameStore.getState().gameState;
        const meAfter = useGameStore.getState().playerId
          ? st?.players.find((p) => p.id === useGameStore.getState().playerId)
          : undefined;
        const queued = !!meAfter?.isSpectator && st?.phase !== 'lobby';
        saveSession({
          roomId: code,
          username,
          avatar,
          playerId: useGameStore.getState().playerId ?? undefined,
          savedAt: Date.now(),
          queuedForNextGame: queued,
        });
        saveUserProfile({ username, avatar });
        setActiveRoom(code, { queue: queued });
        setNeedsJoinForm(false);
        if (queued) setQueueNotice(true);
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes('Room not found') && (await tryRecreateRoom())) return;
        setJoinError(msg);
        throw e;
      }
    },
    [code, joinRoom, gameState?.phase, tryRecreateRoom]
  );

  useEffect(() => {
    if (!code || !isConnected) return;
    if (registered) {
      setNeedsJoinForm(false);
      setActiveRoom(code, { wasManager: me?.isRoomManager });
      return;
    }

    if (session && !registered) {
      if (!autoJoinAttempted.current) {
        autoJoinAttempted.current = true;
        performJoin(session.username, session.avatar as AvatarEmoji, false).catch(() => {
          abandonRoom(code);
          navigate('/', { replace: true });
        });
      }
      return;
    }

    if (intent === 'spectate') {
      if (!spectateAttempted.current) {
        spectateAttempted.current = true;
        getSocket().emit('spectate:room', code);
      }
      return;
    }

    const prof = loadUserProfile();
    if (prof?.username && !autoJoinAttempted.current && (intent === 'invite' || intent === 'join')) {
      autoJoinAttempted.current = true;
      const wantSpectate = intent === 'join' && gameState?.phase !== 'lobby' && !!gameState;
      performJoin(prof.username, prof.avatar as AvatarEmoji, wantSpectate).catch(() => {
        setNeedsJoinForm(true);
      });
      return;
    }

    setNeedsJoinForm(true);
  }, [code, isConnected, registered, session, intent, performJoin, gameState?.phase, me?.isRoomManager]);

  // Load room snapshot for join gate when user has no session yet
  useEffect(() => {
    if (!code || !isConnected || session || registered) return;
    if (gameState?.roomId === code) return;
    if (!spectateAttempted.current) {
      spectateAttempted.current = true;
      getSocket().emit('spectate:room', code);
    }
  }, [code, isConnected, session, registered, gameState?.roomId]);

  // Queue: when game ends / returns to lobby, promote spectator to player if they queued
  useEffect(() => {
    if (!code || !isConnected || !gameState) return;
    const sess = loadSession(code);
    if (!sess?.queuedForNextGame) return;
    if (gameState.phase !== 'lobby') return;
    if (registered && !isSpectator) {
      saveSession({ ...sess, queuedForNextGame: false });
      setQueueNotice(false);
      return;
    }
    if (isSpectator || !registered) {
      const prof = loadUserProfile();
      if (prof?.username) {
        performJoin(prof.username, prof.avatar as AvatarEmoji, false).catch(() => {});
      }
    }
  }, [code, gameState?.phase, isConnected, registered, isSpectator, performJoin]);

  useEffect(() => {
    if (!code) return;
    if (!lastSocketError?.toLowerCase().includes('room not found')) return;
    void tryRecreateRoom().then((recreated) => {
      if (!recreated) {
        abandonRoom(code);
        navigate('/', { replace: true });
      }
    });
  }, [lastSocketError, tryRecreateRoom, code, navigate]);

  // Stale session or dead room: never leave user on the connecting spinner
  useEffect(() => {
    if (!code || gameState?.roomId === code) return;

    const bail = () => {
      abandonRoom(code);
      navigate('/', { replace: true });
    };

    if (lastSocketError?.toLowerCase().includes('room not found')) {
      bail();
      return;
    }

    const t = setTimeout(bail, ROOM_JOIN_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [code, gameState?.roomId, lastSocketError, navigate]);

  const displayError =
    joinError || (session && !needsJoinForm ? lastSocketError : '');

  if (needsJoinForm && !registered && !session) {
    const inProgress = gameState && gameState.roomId === code && gameState.phase !== 'lobby';
    return (
      <JoinRoomGate
        roomId={code}
        title={inProgress ? 'Join Next Game' : 'Join Room'}
        subtitle={
          inProgress
            ? 'This game is in progress. You will spectate until the next lobby.'
            : undefined
        }
        submitLabel={inProgress ? 'Spectate & Queue' : 'Join Room'}
        onSubmit={(username, avatar) =>
          performJoin(username, avatar, !!inProgress)
        }
        onCancel={() => {
          void confirmLeaveHome(navigate, () => {
            clearActiveRoom();
            if (code) abandonRoom(code);
          });
        }}
      />
    );
  }

  if (displayError && !gameState) {
    return (
      <div data-testid="room-error" className="h-full app-bg flex flex-col items-center justify-center gap-6 p-6">
        <div className="text-5xl">🚫</div>
        <div className="text-center space-y-1">
          <p className="text-white font-semibold">Could not rejoin room</p>
          <p className="text-white/50 text-sm">{displayError}</p>
        </div>
        <button
          onClick={() => {
            void confirmLeaveHome(navigate, () => {
              if (code) abandonRoom(code);
            });
          }}
          className="glass-button rounded-xl px-6 py-3 text-white text-sm"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  if (!gameState || gameState.roomId !== code) {
    return <div data-testid="room-loading" className="h-full app-bg min-h-0" aria-busy="true" />;
  }

  if (queueNotice && isSpectator) {
    return (
      <div className="h-full app-bg flex flex-col">
        <div className="flex-shrink-0 px-4 py-2 bg-amber-500/15 border-b border-amber-500/20 text-center text-xs text-amber-200">
          Game in progress — you are spectating. You will join automatically when the next lobby opens.
        </div>
        <div className="flex-1 min-h-0">
          <GameScreen gameState={gameState} />
        </div>
      </div>
    );
  }

  if (gameState.phase === 'lobby') {
    return <LobbyScreen gameState={gameState} />;
  }

  return <GameScreen gameState={gameState} />;
}
