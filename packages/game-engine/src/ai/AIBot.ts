import {
  Player,
  BotMemory,
  BotPersona,
  ChatMessage,
  GameState,
  RoleType,
} from '@snakesss/shared-types';
import {
  PERSONAS,
  AGGRESSIVE_PHRASES,
  DEFENSIVE_PHRASES,
  STRATEGIC_PHRASES,
  CHAOTIC_PHRASES,
  SNAKE_DEFLECTION_PHRASES,
  VILLAGER_ASSURANCE_PHRASES,
  PersonaConfig,
} from './personas';
import { weightedRandom } from '../utils';

// ─── AI Provider Interface (plug-in) ─────────────────────────────────────────

export interface AIProvider {
  generateMessage(context: AIContext): Promise<string>;
  generateVoteRationale(context: AIContext, targetId: string): Promise<string>;
}

export interface AIContext {
  botPlayer: Player;
  role: RoleType;
  persona: BotPersona;
  memory: BotMemory;
  recentMessages: ChatMessage[];
  alivePlayers: Player[];
  round: number;
  accusedBy: string[];
}

// ─── Fallback rule-based generator (used without xAI key) ────────────────────

export class RuleBasedProvider implements AIProvider {
  async generateMessage(ctx: AIContext): Promise<string> {
    const config = PERSONAS[ctx.persona];
    const { role, memory, alivePlayers, round, accusedBy } = ctx;

    const otherPlayers = alivePlayers.filter((p) => p.id !== ctx.botPlayer.id);
    const randomTarget = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];

    if (!randomTarget) return "...";

    const wasAccused = accusedBy.length > 0;
    const rand = Math.random();

    if (wasAccused && rand < config.defensiveness) {
      return fillTemplate(pickRandom(DEFENSIVE_PHRASES), {
        target: randomTarget.username,
        player: ctx.botPlayer.username,
        round: String(round),
      });
    }

    if (role === 'snake') {
      if (rand < config.accusationBias) {
        return fillTemplate(pickRandom(SNAKE_DEFLECTION_PHRASES), {
          target: randomTarget.username,
          target2: otherPlayers[1]?.username ?? randomTarget.username,
        });
      }
    }

    if (ctx.persona === 'aggressive') {
      if (rand < config.accusationBias) {
        return fillTemplate(pickRandom(AGGRESSIVE_PHRASES), {
          target: randomTarget.username,
          round: String(round),
        });
      }
    }

    if (ctx.persona === 'silent_strategist') {
      return fillTemplate(pickRandom(STRATEGIC_PHRASES), {
        target: randomTarget.username,
        round: String(round),
      });
    }

    if (ctx.persona === 'chaotic_liar') {
      const target2 = otherPlayers[Math.min(1, otherPlayers.length - 1)];
      return fillTemplate(pickRandom(CHAOTIC_PHRASES), {
        target: randomTarget.username,
        target2: target2?.username ?? randomTarget.username,
      });
    }

    return fillTemplate(pickRandom(VILLAGER_ASSURANCE_PHRASES), {
      player: randomTarget.username,
      target: randomTarget.username,
    });
  }

  async generateVoteRationale(_ctx: AIContext, _targetId: string): Promise<string> {
    return '';
  }
}

// ─── xAI Provider (injected when key is present) ─────────────────────────────

export class XAIProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://api.x.ai/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateMessage(ctx: AIContext): Promise<string> {
    const systemPrompt = buildSystemPrompt(ctx);
    const userPrompt = buildChatPrompt(ctx);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 80,
        temperature: ctx.persona === 'chaotic_liar' ? 1.2 : ctx.persona === 'silent_strategist' ? 0.4 : 0.8,
      }),
    });

    if (!response.ok) {
      const fallback = new RuleBasedProvider();
      return fallback.generateMessage(ctx);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content?.trim() ?? '...';
  }

  async generateVoteRationale(ctx: AIContext, targetId: string): Promise<string> {
    const target = ctx.alivePlayers.find((p) => p.id === targetId);
    const systemPrompt = buildSystemPrompt(ctx);
    const prompt = `In 1 sentence, explain why you're voting to eliminate ${target?.username ?? 'this player'}. Stay in character.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'grok-3-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 40,
          temperature: 0.7,
        }),
      });

      if (!response.ok) return '';
      const data = await response.json() as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content?.trim() ?? '';
    } catch {
      return '';
    }
  }
}

// ─── Bot Decision Engine ──────────────────────────────────────────────────────

export class BotDecisionEngine {
  private provider: AIProvider;
  private memory: Map<string, BotMemory> = new Map();

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  getMemory(botId: string): BotMemory {
    if (!this.memory.has(botId)) {
      this.memory.set(botId, {
        accusationsReceived: [],
        accusationsMade: [],
        votesFor: [],
        perceivedThreat: {},
        chatHistory: [],
      });
    }
    return this.memory.get(botId)!;
  }

  updateMemory(botId: string, update: Partial<BotMemory>): void {
    const existing = this.getMemory(botId);
    this.memory.set(botId, { ...existing, ...update });
  }

  async decideMessage(
    bot: Player,
    role: RoleType,
    state: GameState,
    accusedBy: string[]
  ): Promise<{ message: string; delay: number } | null> {
    const persona = bot.botPersona ?? 'chaotic_liar';
    const config = PERSONAS[persona];

    if (Math.random() > config.chatFrequency) return null;

    const memory = this.getMemory(bot.id);
    const recentMessages = state.chat.slice(-10);
    const alivePlayers = state.players.filter((p) => p.isAlive && !p.isSpectator);

    const ctx: AIContext = {
      botPlayer: bot,
      role,
      persona,
      memory,
      recentMessages,
      alivePlayers,
      round: state.round,
      accusedBy,
    };

    const message = await this.provider.generateMessage(ctx);
    const charCount = message.length;
    const delay = Math.floor(
      charCount * ((config.typingSpeed.min + config.typingSpeed.max) / 2) +
        Math.random() * 1000
    );

    memory.chatHistory.push(message);
    this.updateMemory(bot.id, { chatHistory: memory.chatHistory.slice(-20) });

    return { message, delay };
  }

  async decideVote(
    bot: Player,
    role: RoleType,
    state: GameState,
    knownSnakes: string[]
  ): Promise<string | null> {
    const persona = bot.botPersona ?? 'chaotic_liar';
    const config = PERSONAS[persona];
    const memory = this.getMemory(bot.id);
    const alivePlayers = state.players.filter(
      (p) => p.isAlive && !p.isSpectator && p.id !== bot.id
    );

    if (alivePlayers.length === 0) return null;

    // Random chaotic vote
    if (Math.random() < config.voteRandomness) {
      return alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
    }

    // Snakes vote strategically against threatening villagers
    if (role === 'snake' && knownSnakes.length > 0) {
      const nonSnakes = alivePlayers.filter((p) => !knownSnakes.includes(p.id));
      if (nonSnakes.length > 0) {
        const threateningSorted = nonSnakes.sort(
          (a, b) => (memory.perceivedThreat[b.id] ?? 0) - (memory.perceivedThreat[a.id] ?? 0)
        );
        return threateningSorted[0].id;
      }
    }

    // Vote based on perceived threat or most-accused
    const weights = alivePlayers.map((p) => {
      const threat = memory.perceivedThreat[p.id] ?? 0;
      const accused = memory.accusationsMade.filter((a) => a.against === p.id).length;
      return 1 + threat * 3 + accused * 2;
    });

    return weightedRandom(alivePlayers, weights).id;
  }

  registerAccusation(botId: string, from: string, round: number): void {
    const memory = this.getMemory(botId);
    memory.accusationsReceived.push({ from, round });
    memory.perceivedThreat[from] = Math.min(1, (memory.perceivedThreat[from] ?? 0) + 0.2);
    this.updateMemory(botId, memory);
  }

  clearMemory(botId: string): void {
    this.memory.delete(botId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function buildSystemPrompt(ctx: AIContext): string {
  const roleDesc = ctx.role === 'snake'
    ? 'You are secretly a SNAKE. Your goal is to avoid being caught while manipulating others into eliminating Villagers.'
    : ctx.role === 'seer'
    ? 'You are the SEER. You can sense whether someone is a Snake, but you must be careful about revealing this.'
    : 'You are a VILLAGER. Your goal is to identify and eliminate all Snakes.';

  const personaDesc: Record<BotPersona, string> = {
    aggressive: 'You are loud, accusatory, and confrontational. You call people out directly.',
    silent_strategist: 'You are calculating and quiet. You only speak when it matters. Short sentences.',
    chaotic_liar: 'You are chaotic and unpredictable. You contradict yourself, make jokes, and derail.',
  };

  return `You are playing a social deduction game called Snakesss.
${roleDesc}
Persona: ${personaDesc[ctx.persona]}
Round: ${ctx.round}
Players alive: ${ctx.alivePlayers.map((p) => p.username).join(', ')}
Your name: ${ctx.botPlayer.username}

Rules:
- Keep messages under 80 characters
- Never break character
- Never mention game mechanics directly
- Sound human and natural
- Do not use quotation marks around your message`;
}

function buildChatPrompt(ctx: AIContext): string {
  const recent = ctx.recentMessages
    .slice(-5)
    .map((m) => `${m.playerName}: ${m.content}`)
    .join('\n');

  const accused = ctx.accusedBy.length > 0
    ? `You were just accused by: ${ctx.accusedBy.join(', ')}.`
    : '';

  return `Recent chat:\n${recent}\n\n${accused}\n\nWhat do you say? (one short message, no quotes)`;
}
