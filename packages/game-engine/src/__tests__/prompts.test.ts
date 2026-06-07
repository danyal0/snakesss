import { describe, it, expect } from 'vitest';
import {
  buildRolePrompt,
  buildSystemPrompt,
  buildDiscussionPrompt,
  buildAnswerPrompt,
  buildVoteRationalePrompt,
} from '../ai/prompts';
import type { PromptContext } from '../ai/prompts';
import type { Player } from '@snakesss/shared-types';

function makeCtx(overrides: Partial<PromptContext> = {}): PromptContext {
  const bot: Player = {
    id: 'b1',
    username: 'Bot_1',
    avatar: '🐍',
    isBot: true,
    botPersona: 'aggressive',
    isSpectator: false,
    isRoomManager: false,
    isConnected: true,
    isAlive: true,
    score: 0,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };

  return {
    botPlayer: bot,
    role: 'human',
    persona: 'aggressive',
    memory: {
      accusationsReceived: [],
      accusationsMade: [],
      votesFor: [],
      perceivedThreat: {},
      chatHistory: [],
      observedMessages: [],
      answerLocked: false,
      suspectedSnakeIds: [],
      discussionMessagesThisRound: 0,
    },
    recentMessages: [],
    alivePlayers: [bot],
    round: 1,
    accusedBy: [],
    ...overrides,
  };
}

describe('buildRolePrompt', () => {
  it('includes improved snake deception guidance', () => {
    const prompt = buildRolePrompt('snake');
    expect(prompt).toContain('You KNOW the correct answer');
    expect(prompt).toContain('WITHOUT making it obvious');
    expect(prompt).not.toContain('Stick to this line');
  });

  it('includes human deduction guidance', () => {
    const prompt = buildRolePrompt('human');
    expect(prompt).toContain('do NOT know the correct answer');
    expect(prompt).toContain('identify potential Snakes');
  });

  it('maps mongoose to truth-seeker framing', () => {
    const prompt = buildRolePrompt('mongoose');
    expect(prompt).toContain('Truth-Seeker');
    expect(prompt).toContain('Never say you "know" the answer');
  });
});

describe('buildSystemPrompt', () => {
  it('includes snake secret strategy without rigid stick-to-line wording', () => {
    const prompt = buildSystemPrompt(
      makeCtx({
        role: 'snake',
        correctIndex: 0,
        defendedAnswerIndex: 1,
        question: {
          id: 'q1',
          text: 'Test?',
          options: ['A', 'B', 'C'],
          correctIndex: 0,
        },
      })
    );
    expect(prompt).toContain('Secret: correct is A');
    expect(prompt).toContain('Vary how hard you push');
    expect(prompt).not.toContain('Stick to this line');
  });
});

describe('buildDiscussionPrompt', () => {
  it('frames discussion as social table talk', () => {
    const prompt = buildDiscussionPrompt(makeCtx());
    expect(prompt).toContain('sitting at the table with friends');
    expect(prompt).toContain('human-like uncertainty');
  });
});

describe('buildAnswerPrompt', () => {
  it('requests letter plus one-sentence justification', () => {
    const prompt = buildAnswerPrompt(
      makeCtx({
        question: {
          id: 'q1',
          text: 'Capital?',
          options: ['Paris', 'London', 'Berlin'],
          correctIndex: 0,
        },
      })
    );
    expect(prompt).toContain('A, B, or C');
    expect(prompt).toContain('1 sentence max');
  });
});

describe('buildVoteRationalePrompt', () => {
  it('includes target name', () => {
    expect(buildVoteRationalePrompt('Alice')).toContain('Alice');
  });
});
