import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceSpeakingPayload } from '@snakesss/shared-types';
import { getSocket } from './useSocket';
import { useGameStore } from '../store/gameStore';
import { VoiceWebRtcManager, type VoiceRtcDebugState } from '../utils/voiceWebRtc';
import type { RtcSignalData } from '../utils/voiceSignaling';

export type VoiceMode = 'open' | 'push';

const VOICE_MODE_KEY = 'snakesss_voice_mode';

function loadVoiceMode(): VoiceMode {
  try {
    const v = localStorage.getItem(VOICE_MODE_KEY);
    return v === 'push' ? 'push' : 'open';
  } catch {
    return 'open';
  }
}

declare global {
  interface Window {
    __VOICE_DEBUG__?: {
      getState: () => VoiceRtcDebugState;
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

  const rtcRef = useRef<VoiceWebRtcManager | null>(null);
  const voicePeersRef = useRef<string[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSpeakingEmitRef = useRef(0);
  const pushHeldRef = useRef(false);
  const micEnabledRef = useRef(false);
  const micMutedRef = useRef(false);
  const playerIdRef = useRef<string | null>(null);
  const enabledRef = useRef(enabled);

  if (!rtcRef.current) {
    rtcRef.current = new VoiceWebRtcManager((targetId: string, data: RtcSignalData) => {
      getSocket().emit('voice:signal', { targetId, signal: data });
    });
  }

  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  useEffect(() => {
    playerIdRef.current = playerId;
    rtcRef.current?.setSelfId(playerId ?? null);
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

  const stopAudioMonitor = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
  }, []);

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
      !micMutedRef.current &&
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
  }, [voiceMode]);

  const startAudioMonitor = useCallback(
    (stream: MediaStream) => {
      stopAudioMonitor();

      const AudioCtx =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      void ctx.resume().catch(() => {});

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      rafRef.current = requestAnimationFrame(monitorLocalAudio);
    },
    [monitorLocalAudio, stopAudioMonitor]
  );

  const teardown = useCallback(() => {
    stopAudioMonitor();
    rtcRef.current?.disableMic();
    if (micEnabledRef.current) {
      getSocket().emit('voice:leave');
    }
    micEnabledRef.current = false;
    voicePeersRef.current = [];
    setSpeakingLevels({});
  }, [stopAudioMonitor]);

  const enableMic = useCallback(async () => {
    if (!enabledRef.current || !roomId || !playerIdRef.current || !rtcRef.current) return false;

    try {
      const stream = await rtcRef.current.enableMic();
      startAudioMonitor(stream);

      micEnabledRef.current = true;
      setMicEnabled(true);
      setMicMuted(false);
      setPermissionDenied(false);

      getSocket().emit('voice:join', (peers: string[]) => {
        const selfId = playerIdRef.current!;
        voicePeersRef.current = [...peers, selfId];
        rtcRef.current?.syncPeers(voicePeersRef.current);
      });

      return true;
    } catch {
      setPermissionDenied(true);
      return false;
    }
  }, [roomId, startAudioMonitor]);

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
    const rtc = rtcRef.current!;

    const onPeers = (peerIds: string[]) => {
      voicePeersRef.current = peerIds;
      if (micEnabledRef.current) {
        rtc.syncPeers(peerIds);
      }
    };

    const onSignal = (fromId: string, signal: unknown) => {
      void rtc.handleSignal(fromId, signal);
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
  }, [disableMic, enabled, roomId]);

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
      getState: () =>
        rtcRef.current?.getDebugState() ?? { micEnabled: false, peerCount: 0, peers: [] },
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
