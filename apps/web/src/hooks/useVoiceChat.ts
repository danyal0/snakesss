import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceSpeakingPayload } from '@snakesss/shared-types';
import { getSocket } from './useSocket';
import { useGameStore } from '../store/gameStore';
import {
  isIceCandidate,
  isSessionDescription,
  remotePeerIds,
  shouldInitiateOffer,
} from '../utils/voiceSignaling';

export type VoiceMode = 'open' | 'push';

const VOICE_MODE_KEY = 'snakesss_voice_mode';
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

function loadVoiceMode(): VoiceMode {
  try {
    const v = localStorage.getItem(VOICE_MODE_KEY);
    return v === 'push' ? 'push' : 'open';
  } catch {
    return 'open';
  }
}

function attachStreamToAudio(remoteId: string, stream: MediaStream): void {
  const domAudio = document.getElementById(`voice-audio-${remoteId}`) as HTMLAudioElement | null;
  const audio = domAudio ?? (() => {
    const el = document.createElement('audio');
    el.id = `voice-audio-${remoteId}`;
    el.autoplay = true;
    el.setAttribute('playsinline', 'true');
    el.className = 'hidden';
    document.body.appendChild(el);
    return el;
  })();

  audio.muted = false;
  audio.volume = 1;
  audio.srcObject = stream;
  void audio.play().catch(() => {
    const retry = () => {
      void audio.play().catch(() => {});
      document.removeEventListener('pointerdown', retry);
    };
    document.addEventListener('pointerdown', retry, { once: true });
  });
}

export interface VoiceDebugState {
  micEnabled: boolean;
  peerCount: number;
  peers: Array<{
    remoteId: string;
    connectionState: RTCPeerConnectionState;
    iceState: RTCIceConnectionState;
    signalingState: RTCSignalingState;
    hasRemoteTrack: boolean;
  }>;
}

declare global {
  interface Window {
    __VOICE_DEBUG__?: {
      getState: () => VoiceDebugState;
    };
  }
}

export function useVoiceChat(enabled: boolean) {
  const playerId = useGameStore((s) => s.playerId);
  const roomId = useGameStore((s) => s.gameState?.roomId);
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(loadVoiceMode);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [speakingLevels, setSpeakingLevels] = useState<Record<string, number>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteTrackRef = useRef<Map<string, boolean>>(new Map());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSpeakingEmitRef = useRef(0);
  const pushHeldRef = useRef(false);
  const micEnabledRef = useRef(false);
  const playerIdRef = useRef<string | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const setVoiceMode = useCallback((mode: VoiceMode) => {
    setVoiceModeState(mode);
    try {
      localStorage.setItem(VOICE_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const emitSignal = useCallback((targetId: string, signal: unknown) => {
    getSocket().emit('voice:signal', { targetId, signal });
  }, []);

  const flushPendingIce = useCallback(async (remoteId: string, pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current.get(remoteId) ?? [];
    if (pending.length === 0) return;
    pendingIceRef.current.delete(remoteId);
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // stale candidate
      }
    }
  }, []);

  const addLocalTracks = useCallback(
    async (pc: RTCPeerConnection, remoteId: string) => {
      const stream = localStreamRef.current;
      if (!stream) return;

      let added = false;
      for (const track of stream.getTracks()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) {
          await sender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
          added = true;
        }
      }

      if (added && pc.signalingState === 'stable' && shouldInitiateOffer(playerIdRef.current ?? '', remoteId)) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitSignal(remoteId, offer);
      }
    },
    [emitSignal]
  );

  const createPeer = useCallback(
    async (remoteId: string, initiator: boolean) => {
      const selfId = playerIdRef.current;
      if (!selfId || peersRef.current.has(remoteId)) return;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(remoteId, pc);
      pendingIceRef.current.set(remoteId, []);

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        emitSignal(remoteId, ev.candidate.toJSON());
      };

      pc.ontrack = (ev) => {
        const remoteStream = ev.streams[0] ?? new MediaStream([ev.track]);
        remoteTrackRef.current.set(remoteId, true);
        attachStreamToAudio(remoteId, remoteStream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          pc.restartIce();
        }
      };

      await addLocalTracks(pc, remoteId);

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitSignal(remoteId, offer);
      }
    },
    [addLocalTracks, emitSignal]
  );

  const connectToPeer = useCallback(
    (remoteId: string) => {
      const selfId = playerIdRef.current;
      if (!selfId || remoteId === selfId || peersRef.current.has(remoteId)) return;
      void createPeer(remoteId, shouldInitiateOffer(selfId, remoteId));
    },
    [createPeer]
  );

  const handleSignal = useCallback(
    async (fromId: string, signal: unknown) => {
      let pc = peersRef.current.get(fromId);
      if (!pc) {
        await createPeer(fromId, false);
        pc = peersRef.current.get(fromId);
      }
      if (!pc) return;

      if (isSessionDescription(signal)) {
        if (signal.type === 'offer') {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setLocalDescription({ type: 'rollback' });
          }
          await pc.setRemoteDescription(signal);
          await flushPendingIce(fromId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitSignal(fromId, answer);
          await addLocalTracks(pc, fromId);
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(signal);
          await flushPendingIce(fromId, pc);
        }
        return;
      }

      if (isIceCandidate(signal)) {
        if (!pc.remoteDescription) {
          const queue = pendingIceRef.current.get(fromId) ?? [];
          queue.push(signal);
          pendingIceRef.current.set(fromId, queue);
          return;
        }
        try {
          await pc.addIceCandidate(signal);
        } catch {
          // stale candidate
        }
      }
    },
    [addLocalTracks, createPeer, emitSignal, flushPendingIce]
  );

  const monitorLocalAudio = useCallback(() => {
    const analyser = analyserRef.current;
    const selfId = playerIdRef.current;
    if (!analyser || !selfId) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i]!;
    const level = Math.min(1, sum / (data.length * 128));
    const threshold = 0.08;
    const speaking =
      micEnabledRef.current &&
      !micMuted &&
      (voiceMode === 'open' || pushHeldRef.current) &&
      level > threshold;

    setSpeakingLevels((prev) => ({ ...prev, [selfId]: speaking ? level : 0 }));

    const now = Date.now();
    if (now - lastSpeakingEmitRef.current > 80) {
      lastSpeakingEmitRef.current = now;
      getSocket().emit('voice:speaking', {
        playerId: selfId,
        level: speaking ? level : 0,
        speaking,
      } satisfies VoiceSpeakingPayload);
    }

    rafRef.current = requestAnimationFrame(monitorLocalAudio);
  }, [micMuted, voiceMode]);

  const teardown = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    pendingIceRef.current.clear();
    remoteTrackRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    analyserRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    if (micEnabledRef.current) {
      getSocket().emit('voice:leave');
    }
    micEnabledRef.current = false;
    setSpeakingLevels({});
  }, []);

  const enableMic = useCallback(async () => {
    if (!enabledRef.current || !roomId || !playerIdRef.current) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      localStreamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      micEnabledRef.current = true;
      setMicEnabled(true);
      setMicMuted(false);
      setPermissionDenied(false);

      for (const [remoteId, pc] of peersRef.current) {
        await addLocalTracks(pc, remoteId);
      }

      getSocket().emit('voice:join', (peers: string[]) => {
        remotePeerIds(peers, playerIdRef.current ?? '').forEach((id) => connectToPeer(id));
      });

      rafRef.current = requestAnimationFrame(monitorLocalAudio);
      return true;
    } catch {
      setPermissionDenied(true);
      return false;
    }
  }, [addLocalTracks, connectToPeer, monitorLocalAudio, roomId]);

  const disableMic = useCallback(() => {
    setMicEnabled(false);
    setMicMuted(false);
    teardown();
  }, [teardown]);

  const toggleMic = useCallback(async () => {
    if (micEnabledRef.current) {
      disableMic();
      return;
    }
    await enableMic();
  }, [disableMic, enableMic]);

  const setPushToTalkHeld = useCallback((held: boolean) => {
    pushHeldRef.current = held;
    const selfId = playerIdRef.current;
    if (!held && selfId) {
      setSpeakingLevels((prev) => ({ ...prev, [selfId]: 0 }));
      getSocket().emit('voice:speaking', {
        playerId: selfId,
        level: 0,
        speaking: false,
      } satisfies VoiceSpeakingPayload);
    }
  }, []);

  // Stable socket listeners — use refs so we never miss voice:peers during mic enable.
  useEffect(() => {
    if (!enabled || !roomId) {
      disableMic();
      return;
    }

    const socket = getSocket();

    const onPeers = (peerIds: string[]) => {
      if (!micEnabledRef.current || !playerIdRef.current) return;
      remotePeerIds(peerIds, playerIdRef.current).forEach((id) => connectToPeer(id));
    };

    const onSignal = (fromId: string, signal: unknown) => {
      void handleSignal(fromId, signal);
    };

    const onSpeaking = (payload: VoiceSpeakingPayload) => {
      setSpeakingLevels((prev) => ({
        ...prev,
        [payload.playerId]: payload.speaking ? payload.level : 0,
      }));
    };

    socket.on('voice:peers', onPeers);
    socket.on('voice:signal', onSignal);
    socket.on('voice:speaking', onSpeaking);

    return () => {
      socket.off('voice:peers', onPeers);
      socket.off('voice:signal', onSignal);
      socket.off('voice:speaking', onSpeaking);
    };
  }, [connectToPeer, disableMic, enabled, handleSignal, roomId]);

  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  useEffect(() => {
    if (typeof window === 'undefined' || !document.documentElement.hasAttribute('data-e2e')) {
      return;
    }

    window.__VOICE_DEBUG__ = {
      getState: () => ({
        micEnabled: micEnabledRef.current,
        peerCount: peersRef.current.size,
        peers: [...peersRef.current.entries()].map(([remoteId, pc]) => ({
          remoteId,
          connectionState: pc.connectionState,
          iceState: pc.iceConnectionState,
          signalingState: pc.signalingState,
          hasRemoteTrack: remoteTrackRef.current.get(remoteId) ?? false,
        })),
      }),
    };

    return () => {
      delete window.__VOICE_DEBUG__;
    };
  }, []);

  return {
    voiceMode,
    setVoiceMode,
    micEnabled,
    micMuted,
    setMicMuted,
    permissionDenied,
    speakingLevels,
    toggleMic,
    enableMic,
    disableMic,
    setPushToTalkHeld,
  };
}
