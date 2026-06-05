import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AvatarEmoji } from '@snakesss/shared-types';
import { GameEngine } from '../GameEngine';
import * as questions from '../questions';

describe('question preload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses preloaded question in transitionToQuestion without refetching', async () => {
    const stub = {
      id: 'q-preload',
      text: 'Preloaded?',
      options: ['A', 'B', 'C'] as [string, string, string],
      correctIndex: 0 as const,
    };
    vi.spyOn(questions, 'fetchApprovedQuestion').mockResolvedValue(stub);
    vi.spyOn(questions, 'getRandomQuestion').mockReturnValue(stub);

    const engine = new GameEngine({
      managerId: 'm1',
      managerName: 'Host',
      managerAvatar: '🦊' as AvatarEmoji,
      xaiApiKey: 'test-key',
      settings: { questionTopic: 'Science', aiQuestionsEnabled: true },
    });

    engine.scheduleQuestionPreload(1);
    await new Promise((r) => setTimeout(r, 50));

    engine.addPlayer('p2', 'B', '🐺' as AvatarEmoji, false);
    engine.addPlayer('p3', 'C', '🦅' as AvatarEmoji, false);
    engine.startGame();

    const fetchCallsBefore = vi.mocked(questions.fetchApprovedQuestion).mock.calls.length;
    await engine.transitionToQuestion();
    const fetchCallsAfter = vi.mocked(questions.fetchApprovedQuestion).mock.calls.length;

    expect(engine.getState().currentQuestion?.id).toBe('q-preload');
    expect(fetchCallsAfter).toBeLessThanOrEqual(fetchCallsBefore + 1);
  });
});
