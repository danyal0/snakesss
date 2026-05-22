import { describe, it, expect, vi } from 'vitest';
import { BotDecisionEngine, RuleBasedProvider } from '../ai/AIBot';
import { PERSONAS } from '../ai/personas';
import type { Player, GameState, AvatarEmoji } from '@snakesss/shared-types';
import { DEFAULT_ROOM_SETTINGS } from '@snakesss/shared-types';

function makeBot(id: string, persona: 'aggressive' | 'silent_strategist' | 'chaotic_liar'): Player {
  return {
    id,
    username: `Bot_${id}`,
    avatar: '🐍' as AvatarEmoji,
    isBot: true,
    botPersona: persona,
    isSpectator: false,
    isRoomManager: false,
    isConnected: true,
    isAlive: true,
    score: 0,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
}

function makePlayer(id: string): Player {
  return {
    id,
    username: id,
    avatar: '🦊' as AvatarEmoji,
    isBot: false,
    isSpectator: false,
    isRoomManager: false,
    isConnected: true,
    isAlive: true,
    score: 0,
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
  };
}

function makeGameState(players: Player[]): GameState {
  return {
    roomId: 'TEST01',
    phase: 'discussion',
    round: 1,
    totalRounds: 6,
    players,
    currentQuestion: null,
    answers: {},
    answersRevealed: [],
    roundScores: {},
    votes: {},
    roundHistory: [],
    chat: [],
    winner: null,
    settings: DEFAULT_ROOM_SETTINGS,
    timeline: [],
    phaseEndsAt: Date.now() + 60000,
    spectators: [],
    isPaused: false,
    createdAt: Date.now(),
    startedAt: Date.now(),
    endedAt: null,
  };
}

describe('PERSONAS config', () => {
  it('has all three personas defined', () => {
    expect(PERSONAS.aggressive).toBeDefined();
    expect(PERSONAS.silent_strategist).toBeDefined();
    expect(PERSONAS.chaotic_liar).toBeDefined();
  });

  it('aggressive has high chat frequency', () => {
    expect(PERSONAS.aggressive.chatFrequency).toBeGreaterThan(0.7);
  });

  it('silent_strategist has low chat frequency', () => {
    expect(PERSONAS.silent_strategist.chatFrequency).toBeLessThan(0.5);
  });
});

describe('RuleBasedProvider', () => {
  it('generates a non-empty message', async () => {
    const provider = new RuleBasedProvider();
    const bot = makeBot('b1', 'aggressive');
    const players = [bot, makePlayer('p1'), makePlayer('p2')];
    const state = makeGameState(players);

    const msg = await provider.generateMessage({
      botPlayer: bot,
      role: 'human',
      persona: 'aggressive',
      memory: {
        accusationsReceived: [],
        accusationsMade: [],
        votesFor: [],
        perceivedThreat: {},
        chatHistory: [],
      },
      recentMessages: [],
      alivePlayers: players,
      round: 1,
      accusedBy: [],
    });

    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('generates snake deflection when role is snake', async () => {
    const provider = new RuleBasedProvider();
    const bot = makeBot('b1', 'aggressive');
    const players = [bot, makePlayer('p1'), makePlayer('p2')];

    const msg = await provider.generateMessage({
      botPlayer: bot,
      role: 'snake',
      persona: 'aggressive',
      memory: {
        accusationsReceived: [],
        accusationsMade: [],
        votesFor: [],
        perceivedThreat: {},
        chatHistory: [],
      },
      recentMessages: [],
      alivePlayers: players,
      round: 1,
      accusedBy: [],
    });

    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});

describe('BotDecisionEngine', () => {
  it('initializes memory for new bots', () => {
    const engine = new BotDecisionEngine(new RuleBasedProvider());
    const memory = engine.getMemory('b1');
    expect(memory.chatHistory).toEqual([]);
    expect(memory.accusationsReceived).toEqual([]);
  });

  it('registers accusations in memory', () => {
    const engine = new BotDecisionEngine(new RuleBasedProvider());
    engine.registerAccusation('b1', 'p1', 1);
    const memory = engine.getMemory('b1');
    expect(memory.accusationsReceived.length).toBe(1);
    expect(memory.perceivedThreat['p1']).toBeGreaterThan(0);
  });

  it('decides a vote for alive players', async () => {
    const engine = new BotDecisionEngine(new RuleBasedProvider());
    const bot = makeBot('b1', 'chaotic_liar');
    const players = [bot, makePlayer('p1'), makePlayer('p2')];
    const state = makeGameState(players);
    state.phase = 'voting';

    const targetId = await engine.decideVote(bot, 'human', state, []);
    expect(typeof targetId).toBe('string');
    expect(['p1', 'p2']).toContain(targetId);
  });

  it('clears memory on demand', () => {
    const engine = new BotDecisionEngine(new RuleBasedProvider());
    engine.registerAccusation('b1', 'p1', 1);
    engine.clearMemory('b1');
    const memory = engine.getMemory('b1');
    expect(memory.accusationsReceived).toEqual([]);
  });
});
