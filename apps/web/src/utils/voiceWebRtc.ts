import {
  isRtcSignalData,
  remotePeerIds,
  shouldInitiateOffer,
  toSessionDescription,
  type RtcSignalData,
} from './voiceSignaling';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface VoiceRtcDebugPeer {
  remoteId: string;
  connectionState: RTCPeerConnectionState;
  iceState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  hasRemoteTrack: boolean;
}

export interface VoiceRtcDebugState {
  micEnabled: boolean;
  peerCount: number;
  peers: VoiceRtcDebugPeer[];
}

export type VoiceSignalEmitter = (targetId: string, data: RtcSignalData) => void;

function attachRemoteAudio(peerId: string, stream: MediaStream): void {
  const domAudio = document.getElementById(`voice-audio-${peerId}`) as HTMLAudioElement | null;
  const audio =
    domAudio ??
    (() => {
      const el = document.createElement('audio');
      el.id = `voice-audio-${peerId}`;
      el.dataset.peerId = peerId;
      el.autoplay = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.className = 'hidden';
      document.body.appendChild(el);
      return el;
    })();

  audio.muted = false;
  audio.volume = 1;
  audio.srcObject = stream;

  const play = () => {
    void audio.play().catch(() => {});
  };
  play();
  audio.addEventListener('loadedmetadata', play, { once: true });

  if (audio.paused) {
    const retry = () => {
      play();
      document.removeEventListener('pointerdown', retry);
      document.removeEventListener('touchstart', retry);
    };
    document.addEventListener('pointerdown', retry, { once: true });
    document.addEventListener('touchstart', retry, { once: true });
  }
}

function clearRemoteAudio(peerId: string): void {
  const audio = document.getElementById(`voice-audio-${peerId}`) as HTMLAudioElement | null;
  if (audio) {
    audio.srcObject = null;
    audio.pause();
  }
  const fallback = document.querySelector(`audio[data-peer-id="${peerId}"]:not(#voice-audio-${peerId})`);
  fallback?.parentNode?.removeChild(fallback);
}

/**
 * WebRTC voice mesh — ported from the reference client.js with renegotiation,
 * glare handling, and ICE queuing fixes for reliable two-way audio.
 */
export class VoiceWebRtcManager {
  private selfId: string | null = null;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private remoteTracks = new Map<string, boolean>();
  private negotiating = new Set<string>();

  constructor(private emitSignal: VoiceSignalEmitter) {}

  setSelfId(selfId: string | null): void {
    this.selfId = selfId;
  }

  isMicEnabled(): boolean {
    return this.localStream != null;
  }

  async enableMic(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.localStream = stream;

    for (const [peerId, pc] of this.peers) {
      this.addLocalTracks(pc);
      await this.renegotiateIfNeeded(peerId, pc);
    }

    return stream;
  }

  disableMic(): void {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;

    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }
    this.pendingIce.clear();
    this.remoteTracks.clear();
    this.negotiating.clear();
  }

  syncPeers(peerIds: string[]): void {
    if (!this.selfId) return;

    const currentIds = remotePeerIds(peerIds, this.selfId);

    for (const peerId of [...this.peers.keys()]) {
      if (!currentIds.includes(peerId)) {
        this.removePeer(peerId);
      }
    }

    currentIds.forEach((peerId) => {
      this.connectToPeer(peerId);
    });
  }

  connectToPeer(peerId: string): void {
    if (!this.selfId || peerId === this.selfId) return;
    const initiator = shouldInitiateOffer(this.selfId, peerId);
    this.createPeerConnection(peerId, initiator);
  }

  async handleSignal(fromId: string, signal: unknown): Promise<void> {
    if (!isRtcSignalData(signal)) return;

    let pc = this.peers.get(fromId);
    if (!pc) {
      pc = this.createPeerConnection(fromId, false);
    }

    try {
      if (signal.type === 'offer') {
        const sdp = toSessionDescription(signal.sdp);
        if (!sdp) return;

        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(sdp);
        await this.flushPendingIce(fromId, pc);

        this.addLocalTracks(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.emitSignal(fromId, { type: 'answer', sdp: answer });
      } else if (signal.type === 'answer') {
        const sdp = toSessionDescription(signal.sdp);
        if (!sdp) return;
        await pc.setRemoteDescription(sdp);
        await this.flushPendingIce(fromId, pc);
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (!pc.remoteDescription) {
          const queue = this.pendingIce.get(fromId) ?? [];
          queue.push(signal.candidate);
          this.pendingIce.set(fromId, queue);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch {
      // stale or duplicate signal
    }
  }

  getDebugState(): VoiceRtcDebugState {
    return {
      micEnabled: this.localStream != null,
      peerCount: this.peers.size,
      peers: [...this.peers.entries()].map(([remoteId, pc]) => ({
        remoteId,
        connectionState: pc.connectionState,
        iceState: pc.iceConnectionState,
        signalingState: pc.signalingState,
        hasRemoteTrack: this.remoteTracks.get(remoteId) ?? false,
      })),
    };
  }

  private createPeerConnection(peerId: string, _isInitiator: boolean): RTCPeerConnection {
    const existing = this.peers.get(peerId);
    if (existing) {
      this.addLocalTracks(existing);
      void this.renegotiateIfNeeded(peerId, existing);
      return existing;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(peerId, pc);
    this.pendingIce.set(peerId, []);

    if (this.localStream) {
      this.addLocalTracks(pc);
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.emitSignal(peerId, { type: 'candidate', candidate: event.candidate.toJSON() });
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      const stream = remoteStream ?? new MediaStream([event.track]);
      this.remoteTracks.set(peerId, true);
      attachRemoteAudio(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        pc.restartIce();
      }
    };

    pc.onnegotiationneeded = () => {
      void this.sendOffer(peerId, pc);
    };

    return pc;
  }

  private addLocalTracks(pc: RTCPeerConnection): void {
    const stream = this.localStream;
    if (!stream) return;

    stream.getTracks().forEach((track) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
      if (sender) {
        void sender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
    });
  }

  private async sendOffer(peerId: string, pc: RTCPeerConnection): Promise<void> {
    if (this.negotiating.has(peerId)) return;
    if (pc.signalingState !== 'stable') return;

    this.negotiating.add(peerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.emitSignal(peerId, { type: 'offer', sdp: offer });
    } catch {
      // negotiation race
    } finally {
      this.negotiating.delete(peerId);
    }
  }

  private async renegotiateIfNeeded(peerId: string, pc: RTCPeerConnection): Promise<void> {
    if (!this.selfId || !this.localStream) return;
    if (!shouldInitiateOffer(this.selfId, peerId)) return;
    await this.sendOffer(peerId, pc);
  }

  private async flushPendingIce(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const pending = this.pendingIce.get(peerId) ?? [];
    if (pending.length === 0) return;
    this.pendingIce.delete(peerId);

    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // stale candidate
      }
    }
  }

  private removePeer(peerId: string): void {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    this.pendingIce.delete(peerId);
    this.remoteTracks.delete(peerId);
    this.negotiating.delete(peerId);
    clearRemoteAudio(peerId);
  }
}
