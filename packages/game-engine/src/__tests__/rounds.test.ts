import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AvatarEmoji } from '@snakesss/shared-types';

function createEngine() {
  return new GameEngine({
    managerId: 'p1',
    managerName: 'Alice',
    managerAvatar: '🦊' as AvatarEmoji,
    settings: {
      roleDistribution: { snakes: 1, humans: 2, mongooses: 0 },
      maxPlayers: 8,
      botsEnabled: false,
      botCount: 0,
      discussionTimer: 60,
      voteTimer: 30,
      questionTimer: 30,
      isPrivate: false,
      allowSpectators: true,
      advancedRoles: false,
      totalRounds: 6,
    },
  });
}

describe('multi-round game flow', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = createEngine();
    engine.addPlayer('p2', 'Bob', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'Carol', '🦅' as AvatarEmoji, false);
    engine.startGame();
  });

  it('clears answers when starting round 2 question', async () => {
    await engine.transitionToQuestion();
    engine.submitAnswer('p1', 0);
    engine.submitAnswer('p2', 1);
    engine.submitAnswer('p3', 2);
    expect(engine.getState().phase).toBe('answer_reveal');
    expect(Object.keys(engine.getState().answers).length).toBeGreaterThan(0);

    engine.nextRound();
    await engine.transitionToQuestion();

    const round2 = engine.getState();
    expect(round2.round).toBe(2);
    expect(round2.phase).toBe('question');
    expect(Object.keys(round2.answers)).toHaveLength(0);
    expect(round2.currentQuestion).not.toBeNull();
  });

  it('allows all players to submit answers again in round 2', async () => {
    await engine.transitionToQuestion();
    engine.submitAnswer('p1', 0);
    engine.submitAnswer('p2', 1);
    engine.submitAnswer('p3', 2);

    engine.nextRound();
    await engine.transitionToQuestion();

    expect(engine.submitAnswer('p1', 1).success).toBe(true);
    expect(engine.submitAnswer('p2', 2).success).toBe(true);
    expect(engine.submitAnswer('p3', 0).success).toBe(true);
    expect(Object.keys(engine.getState().answers)).toHaveLength(3);
  });
});
