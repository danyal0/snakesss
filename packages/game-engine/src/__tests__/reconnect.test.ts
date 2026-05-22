import { describe, it, expect } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AvatarEmoji } from '@snakesss/shared-types';

describe('player reconnect', () => {
  it('reconnectPlayer restores slot even when still marked connected', () => {
    const engine = new GameEngine({
      managerId: 'p1',
      managerName: 'Alice',
      managerAvatar: '🦊' as AvatarEmoji,
    });
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);

    const before = engine.getState().players.find((p) => p.id === 'p1')!;
    expect(before.isConnected).toBe(true);

    engine.reconnectPlayer('p1', 'new-socket-id');

    const after = engine.getState().players.find((p) => p.id === 'p1')!;
    expect(after.isConnected).toBe(true);
    expect(after.id).toBe('p1');
  });
});
