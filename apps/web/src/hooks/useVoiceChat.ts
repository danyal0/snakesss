import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceSpeakingPayload } from '@snakesss/shared-types';
import { getSocket } from './useSocket';
import { useGameStore } from '../store/gameStore';

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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSpeakingEmitRef = useRef(0);
  const pushHeldRef = useRef(false);

  const setVoiceMode = useCallback((mode: VoiceMode) => {
    setVoiceModeState(mode);
    try {
      localStorage.setItem(VOICE_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const teardown = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    analyserRef.current = null;
    getSocket().emit('voice:leave');
    setSpeakingLevels({});
  }, []);

  const createPeer = useCallback(
    async (remoteId: string, initiator: boolean) => {
      if (!playerId || peersRef.current.has(remoteId)) return;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(remoteId, pc);

      const stream = localStreamRef.current;
      stream?.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        getSocket().emit('voice:signal', {
          targetId: remoteId,
          signal: ev.candidate.toJSON(),
        });
      };

      pc.ontrack = (ev) => {
        const audio = document.getElementById(`voice-audio-${remoteId}`) as HTMLAudioElement | null;
        if (audio) {
          audio.srcObject = ev.streams[0] ?? null;
          void audio.play().catch(() => {});
        }
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        getSocket().emit('voice:signal', { targetId: remoteId, signal: offer });
      }
    },
    [playerId]
  );

  const handleSignal = useCallback(
    async (fromId: string, signal: unknown) => {
      let pc = peersRef.current.get(fromId);
      if (!pc) {
        await createPeer(fromId, false);
        pc = peersRef.current.get(fromId);
      }
      if (!pc) return;

      const desc = signal as RTCSessionDescriptionInit;
      if (desc.type === 'offer') {
        await pc.setRemoteDescription(desc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket().emit('voice:signal', { targetId: fromId, signal: answer });
      } else if (desc.type === 'answer') {
        await pc.setRemoteDescription(desc);
      } else {
        try {
          await pc.addIceCandidate(signal as RTCIceCandidateInit);
        } catch {
          // stale candidate
        }
      }
    },
    [createPeer]
  );

  const monitorLocalAudio = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !playerId) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i]!;
    const level = Math.min(1, sum / (data.length * 128));
    const threshold = 0.08;
    const speaking =
      micEnabled &&
      !micMuted &&
      (voiceMode === 'open' || pushHeldRef.current) &&
      level > threshold;

    setSpeakingLevels((prev) => ({ ...prev, [playerId]: speaking ? level : 0 }));

    const now = Date.now();
    if (now - lastSpeakingEmitRef.current > 80) {
      lastSpeakingEmitRef.current = now;
      getSocket().emit('voice:speaking', {
        playerId,
        level: speaking ? level : 0,
        speaking,
      } satisfies VoiceSpeakingPayload);
    }

    rafRef.current = requestAnimationFrame(monitorLocalAudio);
  }, [micEnabled, micMuted, playerId, voiceMode]);

  const enableMic = useCallback(async () => {
    if (!enabled || !roomId || !playerId) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      localStreamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setMicEnabled(true);
      setMicMuted(false);
      setPermissionDenied(false);

      getSocket().emit('voice:join', (peers: string[]) => {
        peers.forEach((id) => void createPeer(id, true));
      });

      rafRef.current = requestAnimationFrame(monitorLocalAudio);
      return true;
    } catch {
      setPermissionDenied(true);
      return false;
    }
  }, [createPeer, enabled, monitorLocalAudio, playerId, roomId]);

  const disableMic = useCallback(() => {
    setMicEnabled(false);
    setMicMuted(false);
    teardown();
  }, [teardown]);

  const toggleMic = useCallback(async () => {
    if (micEnabled) {
      disableMic();
      return;
    }
    await enableMic();
  }, [disableMic, enableMic, micEnabled]);

  const setPushToTalkHeld = useCallback((held: boolean) => {
    pushHeldRef.current = held;
    if (!held && playerId) {
      setSpeakingLevels((prev) => ({ ...prev, [playerId]: 0 }));
      getSocket().emit('voice:speaking', {
        playerId,
        level: 0,
        speaking: false,
      } satisfies VoiceSpeakingPayload);
    }
  }, [playerId]);

  useEffect(() => {
    if (!enabled || !roomId) {
      disableMic();
      return;
    }

    const socket = getSocket();

    const onPeers = (peerIds: string[]) => {
      if (!micEnabled || !playerId) return;
      peerIds.filter((id) => id !== playerId).forEach((id) => {
        void createPeer(id, playerId > id);
      });
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
  }, [createPeer, disableMic, enabled, handleSignal, micEnabled, playerId, roomId]);

  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

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
