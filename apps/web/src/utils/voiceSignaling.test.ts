import { describe, expect, it } from 'vitest';
import {
  isRtcSignalData,
  remotePeerIds,
  shouldInitiateOffer,
  toSessionDescription,
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

  it('detects wrapped RTC signal payloads', () => {
    expect(isRtcSignalData({ type: 'offer', sdp: { type: 'offer', sdp: 'v=0' } })).toBe(true);
    expect(isRtcSignalData({ type: 'answer', sdp: { type: 'answer', sdp: 'v=0' } })).toBe(true);
    expect(
      isRtcSignalData({
        type: 'candidate',
        candidate: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 },
      })
    ).toBe(true);
    expect(isRtcSignalData({ type: 'invalid' })).toBe(false);
    expect(isRtcSignalData(null)).toBe(false);
  });

  it('wraps session descriptions when WebRTC is available', () => {
    if (typeof RTCSessionDescription === 'undefined') {
      expect(toSessionDescription(undefined)).toBeNull();
      return;
    }
    const desc = toSessionDescription({ type: 'offer', sdp: 'v=0' });
    expect(desc?.type).toBe('offer');
    expect(toSessionDescription(undefined)).toBeNull();
  });
});
