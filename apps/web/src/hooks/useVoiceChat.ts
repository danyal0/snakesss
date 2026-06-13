import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceSpeakingPayload } from '@snakesss/shared-types';
import { getSocket } from './useSocket';
import { useGameStore } from '../store/gameStore';
import {
  isRtcSignalData,
  toSessionDescription,
  type RtcSignalData,
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
  const roomPlayerIds = useGameStore((s) => s.gameState?.players.map((p) => p.id) ?? []);
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(loadVoiceMode);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [speakingLevels, setSpeakingLevels] = useState<Record<string, number>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
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

  const emitSignal = useCallback((targetId: string, data: RtcSignalData) => {
    getSocket().emit('voice:signal', { targetId, signal: data });
  }, []);

  const removePeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerId);
    }
    remoteTrackRef.current.delete(peerId);
    const audio = document.querySelector(`audio[data-peer-id="${peerId}"]`);
    if (audio?.parentNode) {
      audio.parentNode.removeChild(audio);
    }
  }, []);

  const addLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
      if (sender) {
        void sender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
    });
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string, isInitiator: boolean): RTCPeerConnection => {
      const existing = peersRef.current.get(peerId);
      if (existing) {
        addLocalTracks(existing);
        return existing;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(peerId, pc);

      addLocalTracks(pc);

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        emitSignal(peerId, { type: 'candidate', candidate: event.candidate.toJSON() });
      };

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        const stream = remoteStream ?? new MediaStream([event.track]);
        remoteTrackRef.current.set(peerId, true);
        attachStreamToAudio(peerId, stream);
      };

      if (isInitiator) {
        pc.onnegotiationneeded = async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            emitSignal(peerId, { type: 'offer', sdp: offer });
          } catch {
            // negotiation race
          }
        };
      }

      return pc;
    },
    [addLocalTracks, emitSignal]
  );

  const syncVoicePeers = useCallback(() => {
    if (!micEnabledRef.current || !playerIdRef.current) return;

    const selfId = playerIdRef.current;
    const currentIds = roomPlayerIds.filter((id) => id !== selfId);

    for (const id of [...peersRef.current.keys()]) {
      if (!currentIds.includes(id)) {
        removePeer(id);
      }
    }

    currentIds.forEach((id) => {
      createPeerConnection(id, true);
    });
  }, [createPeerConnection, removePeer, roomPlayerIds]);

  const handleSignal = useCallback(
    async (fromId: string, signal: unknown) => {
      if (!isRtcSignalData(signal)) return;

      let pc = peersRef.current.get(fromId);
      if (!pc) {
        pc = createPeerConnection(fromId, false);
      }

      try {
        if (signal.type === 'offer') {
          const sdp = toSessionDescription(signal.sdp);
          if (!sdp) return;
          await pc.setRemoteDescription(sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitSignal(fromId, { type: 'answer', sdp: answer });
        } else if (signal.type === 'answer') {
          const sdp = toSessionDescription(signal.sdp);
          if (!sdp) return;
          await pc.setRemoteDescription(sdp);
        } else if (signal.type === 'candidate' && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch {
        // stale or duplicate signal
      }
    },
    [createPeerConnection, emitSignal]
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
    for (const id of [...peersRef.current.keys()]) {
      removePeer(id);
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    analyserRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    micEnabledRef.current = false;
    setSpeakingLevels({});
  }, [removePeer]);

  const enableMic = useCallback(async () => {
    if (!enabledRef.current || !roomId || !playerIdRef.current) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

      syncVoicePeers();
      rafRef.current = requestAnimationFrame(monitorLocalAudio);
      return true;
    } catch {
      setPermissionDenied(true);
      return false;
    }
  }, [monitorLocalAudio, roomId, syncVoicePeers]);

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

  useEffect(() => {
    if (!enabled || !roomId) {
      disableMic();
      return;
    }

    const socket = getSocket();

    const onSignal = (fromId: string, signal: unknown) => {
      void handleSignal(fromId, signal);
    };

    const onSpeaking = (payload: VoiceSpeakingPayload) => {
      setSpeakingLevels((prev) => ({
        ...prev,
        [payload.playerId]: payload.speaking ? payload.level : 0,
      }));
    };

    socket.on('voice:signal', onSignal);
    socket.on('voice:speaking', onSpeaking);

    return () => {
      socket.off('voice:signal', onSignal);
      socket.off('voice:speaking', onSpeaking);
    };
  }, [disableMic, enabled, handleSignal, roomId]);

  useEffect(() => {
    if (micEnabled) {
      syncVoicePeers();
    }
  }, [micEnabled, syncVoicePeers]);

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
