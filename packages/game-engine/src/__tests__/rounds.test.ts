import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import type { AvatarEmoji, VoteChoice } from '@snakesss/shared-types';

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
      questionTimer: 5,
      snakePeekTimer: 5,
      isPrivate: false,
      allowSpectators: true,
      advancedRoles: false,
      totalRounds: 6,
    },
  });
}

function voteForAll(engine: GameEngine, defaultChoice: VoteChoice = 0) {
  engine.transitionToDiscussion();
  engine.transitionToVoting();
  const roles = engine.getAllRoles();
  for (const pid of ['p1', 'p2', 'p3'] as const) {
    const role = roles.get(pid);
    const choice: VoteChoice = role?.type === 'snake' ? 'snake' : defaultChoice;
    engine.submitAnswer(pid, choice);
  }
  engine.transitionToAnswerReveal();
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
    voteForAll(engine);
    expect(engine.getState().phase).toBe('answer_reveal');

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
    voteForAll(engine);

    engine.nextRound();
    await engine.transitionToQuestion();
    engine.transitionToDiscussion();
    engine.transitionToVoting();

    const roles = engine.getAllRoles();
    for (const pid of ['p1', 'p2', 'p3'] as const) {
      const role = roles.get(pid);
      const choice: VoteChoice = role?.type === 'snake' ? 'snake' : 1;
      expect(engine.submitAnswer(pid, choice).success).toBe(true);
    }
    expect(engine.getAnswerMap().size).toBe(3);
  });

  it('rejects answers during discussion and enforces snake token rules', async () => {
    await engine.transitionToQuestion();
    engine.transitionToDiscussion();
    expect(engine.submitAnswer('p1', 0).success).toBe(false);

    engine.transitionToVoting();
    const roles = engine.getAllRoles();
    const snakeId = [...roles.entries()].find(([, r]) => r.type === 'snake')?.[0];
    const humanId = [...roles.entries()].find(([, r]) => r.type === 'human')?.[0];
    expect(snakeId).toBeTruthy();
    expect(humanId).toBeTruthy();

    expect(engine.submitAnswer(snakeId!, 0).success).toBe(false);
    expect(engine.submitAnswer(snakeId!, 'snake').success).toBe(true);
    expect(engine.submitAnswer(humanId!, 'snake').success).toBe(false);
  });
});
