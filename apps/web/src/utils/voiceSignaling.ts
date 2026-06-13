export type RtcSignalType = 'offer' | 'answer' | 'candidate';

export interface RtcSignalData {
  type: RtcSignalType;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export function isRtcSignalData(signal: unknown): signal is RtcSignalData {
  if (!signal || typeof signal !== 'object') return false;
  const type = (signal as RtcSignalData).type;
  return type === 'offer' || type === 'answer' || type === 'candidate';
}

export function toSessionDescription(
  init: RTCSessionDescriptionInit | undefined
): RTCSessionDescription | null {
  if (!init) return null;
  return new RTCSessionDescription(init);
}

export function remotePeerIds(peerIds: string[], selfId: string): string[] {
  return peerIds.filter((id) => id !== selfId);
}
