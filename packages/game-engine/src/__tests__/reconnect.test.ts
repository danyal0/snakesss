import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AvatarEmoji } from '@snakesss/shared-types';

describe('player reconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it('manager keeps role when reconnecting before transfer grace expires', () => {
    const engine = new GameEngine({
      managerId: 'p1',
      managerName: 'Alice',
      managerAvatar: '🦊' as AvatarEmoji,
    });
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);

    engine.removePlayer('p1');

    let state = engine.getState();
    expect(state.players.find((p) => p.id === 'p1')?.isConnected).toBe(false);
    expect(state.players.find((p) => p.id === 'p1')?.isRoomManager).toBe(true);
    expect(state.players.find((p) => p.id === 'p2')?.isRoomManager).toBe(false);

    engine.reconnectPlayer('p1', 'new-socket-id');

    state = engine.getState();
    expect(state.players.find((p) => p.id === 'p1')?.isConnected).toBe(true);
    expect(state.players.find((p) => p.id === 'p1')?.isRoomManager).toBe(true);
    expect(state.players.find((p) => p.id === 'p2')?.isRoomManager).toBe(false);

    vi.advanceTimersByTime(15_000);

    state = engine.getState();
    expect(state.players.find((p) => p.id === 'p1')?.isRoomManager).toBe(true);
    expect(state.players.find((p) => p.id === 'p2')?.isRoomManager).toBe(false);
  });

  it('transfers manager after grace when manager stays offline', () => {
    const engine = new GameEngine({
      managerId: 'p1',
      managerName: 'Alice',
      managerAvatar: '🦊' as AvatarEmoji,
    });
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);

    engine.removePlayer('p1');
    vi.advanceTimersByTime(15_000);

    const state = engine.getState();
    expect(state.players.find((p) => p.id === 'p1')?.isRoomManager).toBe(false);
    expect(state.players.find((p) => p.id === 'p2')?.isRoomManager).toBe(true);
  });
});
