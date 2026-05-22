import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AvatarEmoji } from '@snakesss/shared-types';

function createEngine() {
  return new GameEngine({
    managerId: 'manager1',
    managerName: 'Alice',
    managerAvatar: '🦊' as AvatarEmoji,
    settings: {
      roleDistribution: { snakes: 1, villagers: 2, seers: 0 },
      maxPlayers: 8,
      botsEnabled: false,
      botCount: 0,
      discussionTimer: 60,
      voteTimer: 30,
      isPrivate: false,
      allowSpectators: true,
      advancedRoles: false,
    },
  });
}

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = createEngine();
  });

  it('creates a room with a manager', () => {
    const state = engine.getState();
    expect(state.phase).toBe('lobby');
    expect(state.players.length).toBe(1);
    expect(state.players[0]!.isRoomManager).toBe(true);
    expect(state.roomId).toBeTruthy();
  });

  it('adds players correctly', () => {
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'Carol', '🦅' as AvatarEmoji, false);
    const state = engine.getState();
    expect(state.players.length).toBe(3);
  });

  it('rejects duplicate player IDs and reconnects', () => {
    const result = engine.addPlayer('manager1', 'Alice', '🦊' as AvatarEmoji, false);
    expect(result.success).toBe(true);
    const state = engine.getState();
    expect(state.players.filter((p) => p.id === 'manager1').length).toBe(1);
  });

  it('requires 3 players to start', () => {
    const result = engine.startGame();
    expect(result.success).toBe(false);
    expect(result.error).toContain('3 players');
  });

  it('starts game and assigns roles to 3 players', () => {
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'Carol', '🦅' as AvatarEmoji, false);
    const result = engine.startGame();
    expect(result.success).toBe(true);
    const state = engine.getState();
    expect(state.phase).toBe('dealing');
    expect(state.startedAt).toBeTruthy();

    const roles = engine.getAllRoles();
    expect(roles.size).toBe(3);
    const types = Array.from(roles.values()).map((r) => r.type);
    expect(types).toContain('snake');
    expect(types.filter((t) => t === 'villager').length).toBe(2);
  });

  it('allows chat during discussion only', () => {
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'Carol', '🦅' as AvatarEmoji, false);
    engine.startGame();
    engine.transitionToDiscussion();

    const msg = engine.addMessage('manager1', 'Hello world');
    expect(msg).not.toBeNull();
    expect(msg?.content).toBe('Hello world');
  });

  it('blocks chat outside discussion', () => {
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'Carol', '🦅' as AvatarEmoji, false);
    engine.startGame();

    // Still in 'dealing' phase
    const msg = engine.addMessage('manager1', 'Hello');
    expect(msg).toBeNull();
  });

  it('casts votes and advances when all vote', () => {
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'Carol', '🦅' as AvatarEmoji, false);
    engine.startGame();
    engine.transitionToDiscussion();
    engine.transitionToVoting();

    const state = engine.getState();
    expect(state.phase).toBe('voting');

    const players = state.players.filter((p) => !p.isSpectator);
    // Vote for first non-manager player
    const [p1, p2, p3] = players;
    const target = p3!.id;

    engine.castVote(p1!.id, target);
    engine.castVote(p2!.id, target);
    // After p3 votes, all 3 have voted → auto-advance
    const result = engine.castVote(p3!.id, p1!.id);
    expect(result.success).toBe(true);
  });

  it('eliminates a player and reveals role', () => {
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'Carol', '🦅' as AvatarEmoji, false);
    engine.startGame();
    engine.transitionToDiscussion();
    engine.transitionToVoting();

    const players = engine.getState().players.filter((p) => !p.isSpectator);
    const target = players[0]!;

    engine.castVote(players[1]!.id, target.id);
    engine.castVote(players[2]!.id, target.id);
    engine.castVote(target.id, players[1]!.id);

    engine.resolveVotes();
    const postState = engine.getState();
    const eliminated = postState.players.find((p) => p.id === target.id);
    expect(eliminated?.isAlive).toBe(false);
    expect(eliminated?.role?.revealed).toBe(true);
  });

  it('kicks a player', () => {
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.kickPlayer('p2');
    expect(engine.getState().players.find((p) => p.id === 'p2')).toBeUndefined();
  });

  it('pauses and resumes without phase transitions', () => {
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'Carol', '🦅' as AvatarEmoji, false);
    engine.startGame();
    engine.transitionToDiscussion();
    engine.pause();
    expect(engine.getState().isPaused).toBe(true);
    engine.resume();
    expect(engine.getState().isPaused).toBe(false);
  });

  it('records timeline events', () => {
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'Carol', '🦅' as AvatarEmoji, false);
    engine.startGame();
    const timeline = engine.getState().timeline;
    const types = timeline.map((e) => e.type);
    expect(types).toContain('game_started');
    expect(types).toContain('player_joined');
  });
});
