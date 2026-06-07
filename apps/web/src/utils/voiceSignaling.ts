/** Lower stable player id always initiates the WebRTC offer (avoids glare). */
export function shouldInitiateOffer(localId: string, remoteId: string): boolean {
  return localId < remoteId;
}

export function isSessionDescription(
  signal: unknown
): signal is RTCSessionDescriptionInit {
  const type = (signal as RTCSessionDescriptionInit | undefined)?.type;
  return type === 'offer' || type === 'answer';
}

export function isIceCandidate(signal: unknown): signal is RTCIceCandidateInit {
  if (!signal || typeof signal !== 'object') return false;
  if (isSessionDescription(signal)) return false;
  return 'candidate' in signal;
}

export function remotePeerIds(peerIds: string[], selfId: string): string[] {
  return peerIds.filter((id) => id !== selfId);
}
