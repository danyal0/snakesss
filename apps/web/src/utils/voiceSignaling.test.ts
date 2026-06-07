import { describe, expect, it } from 'vitest';
import {
  isIceCandidate,
  isSessionDescription,
  remotePeerIds,
  shouldInitiateOffer,
} from './voiceSignaling';

describe('voiceSignaling', () => {
  it('picks exactly one initiator per pair', () => {
    const a = 'player-aaa';
    const b = 'player-bbb';
    expect(shouldInitiateOffer(a, b)).toBe(true);
    expect(shouldInitiateOffer(b, a)).toBe(false);
    expect(shouldInitiateOffer(a, b) !== shouldInitiateOffer(b, a)).toBe(true);
  });

  it('filters self from peer list', () => {
    expect(remotePeerIds(['a', 'b', 'a'], 'a')).toEqual(['b']);
  });

  it('detects session descriptions vs ICE candidates', () => {
    expect(isSessionDescription({ type: 'offer', sdp: 'v=0' })).toBe(true);
    expect(isSessionDescription({ type: 'answer', sdp: 'v=0' })).toBe(true);
    expect(
      isIceCandidate({ candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 })
    ).toBe(true);
    expect(isIceCandidate({ type: 'offer', sdp: 'v=0' })).toBe(false);
  });
});
