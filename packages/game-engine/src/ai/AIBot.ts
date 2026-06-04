import {
  Player,
  BotMemory,
  BotPersona,
  ChatMessage,
  GameState,
  RoleType,
  QuizQuestion,
  VoteChoice,
  AnswerIndex,
} from '@snakesss/shared-types';
import {
  PERSONAS,
  AGGRESSIVE_PHRASES,
  DEFENSIVE_PHRASES,
  STRATEGIC_PHRASES,
  CHAOTIC_PHRASES,
  SNAKE_DEFLECTION_PHRASES,
  SNAKE_ANSWER_PUSH_PHRASES,
  HUMAN_SNAKE_SUSPECT_PHRASES,
  HUMAN_ANSWER_CONFIDENCE_PHRASES,
  VILLAGER_ASSURANCE_PHRASES,
  PersonaConfig,
} from './personas';
import { weightedRandom } from '../utils';

const OPTION_LABELS: AnswerIndex[] = [0, 1, 2];
const OPTION_LETTERS = ['A', 'B', 'C'] as const;

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
  question?: QuizQuestion;
  /** Only set for snakes — the real correct answer. */
  correctIndex?: AnswerIndex;
  defendedAnswerIndex?: AnswerIndex;
  chosenAnswer?: VoteChoice;
  answerLocked?: boolean;
  primarySuspectName?: string;
}

// ─── Fallback rule-based generator (used without xAI key) ────────────────────

export class RuleBasedProvider implements AIProvider {
  async generateMessage(ctx: AIContext): Promise<string> {
    const config = PERSONAS[ctx.persona];
    const { role, alivePlayers, round, accusedBy, question, defendedAnswerIndex } = ctx;

    const otherPlayers = alivePlayers.filter((p) => p.id !== ctx.botPlayer.id);
    const randomTarget = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];

    if (!randomTarget) return '...';

    const wasAccused = accusedBy.length > 0;
    const rand = Math.random();

    if (wasAccused && rand < config.defensiveness) {
      return fillTemplate(pickRandom(DEFENSIVE_PHRASES), {
        target: randomTarget.username,
        player: ctx.botPlayer.username,
        round: String(round),
      });
    }

    // Snake: push and defend the chosen wrong answer
    if (role === 'snake' && question && defendedAnswerIndex !== undefined) {
      if (rand < 0.75 || ctx.memory.discussionMessagesThisRound < 2) {
        return fillTemplate(pickRandom(SNAKE_ANSWER_PUSH_PHRASES), {
          option: OPTION_LETTERS[defendedAnswerIndex],
          optionText: question.options[defendedAnswerIndex],
          target: randomTarget.username,
        });
      }
      if (rand < config.accusationBias) {
        return fillTemplate(pickRandom(SNAKE_DEFLECTION_PHRASES), {
          target: randomTarget.username,
          target2: otherPlayers[1]?.username ?? randomTarget.username,
        });
      }
    }

    // Human/mongoose: suspect snakes or argue for an answer
    if (role !== 'snake') {
      const suspect = ctx.primarySuspectName ?? randomTarget.username;
      if (ctx.memory.suspectedSnakeIds.length > 0 && rand < config.accusationBias) {
        const defended = defendedAnswerIndex ?? ctx.chosenAnswer;
        const optionIdx = typeof defended === 'number' ? defended : undefined;
        if (optionIdx !== undefined && question) {
          return fillTemplate(pickRandom(HUMAN_SNAKE_SUSPECT_PHRASES), {
            target: suspect,
            option: OPTION_LETTERS[optionIdx],
          });
        }
        return fillTemplate(pickRandom(AGGRESSIVE_PHRASES), {
          target: suspect,
          round: String(round),
        });
      }

      if (ctx.answerLocked && question && typeof ctx.chosenAnswer === 'number') {
        return fillTemplate(pickRandom(HUMAN_ANSWER_CONFIDENCE_PHRASES), {
          option: OPTION_LETTERS[ctx.chosenAnswer],
          optionText: question.options[ctx.chosenAnswer],
        });
      }
    }

    if (ctx.persona === 'aggressive' && rand < config.accusationBias) {
      return fillTemplate(pickRandom(AGGRESSIVE_PHRASES), {
        target: randomTarget.username,
        round: String(round),
      });
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

    return fillTemplate(pickRandom(VILLAGER_ASSURANCE_PHRASES as string[]), {
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

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'grok-3-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 80,
          temperature:
            ctx.persona === 'chaotic_liar' ? 1.2 : ctx.persona === 'silent_strategist' ? 0.4 : 0.8,
        }),
      });

      if (!response.ok) {
        const fallback = new RuleBasedProvider();
        return fallback.generateMessage(ctx);
      }

      const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content?.trim() ?? '...';
    } catch {
      const fallback = new RuleBasedProvider();
      return fallback.generateMessage(ctx);
    }
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
          Authorization: `Bearer ${this.apiKey}`,
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
      const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content?.trim() ?? '';
    } catch {
      return '';
    }
  }
}

// ─── Bot Decision Engine ──────────────────────────────────────────────────────

function emptyMemory(): BotMemory {
  return {
    accusationsReceived: [],
    accusationsMade: [],
    votesFor: [],
    perceivedThreat: {},
    chatHistory: [],
    observedMessages: [],
    answerLocked: false,
    suspectedSnakeIds: [],
    discussionMessagesThisRound: 0,
  };
}

export class BotDecisionEngine {
  private provider: AIProvider;
  private memory: Map<string, BotMemory> = new Map();

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  getMemory(botId: string): BotMemory {
    if (!this.memory.has(botId)) {
      this.memory.set(botId, emptyMemory());
    }
    return this.memory.get(botId)!;
  }

  updateMemory(botId: string, update: Partial<BotMemory>): void {
    const existing = this.getMemory(botId);
    this.memory.set(botId, { ...existing, ...update });
  }

  /** Reset per-round discussion state and pick snake defense target. */
  initDiscussionRound(
    botId: string,
    role: RoleType,
    question: QuizQuestion,
    correctIndex: AnswerIndex
  ): void {
    const memory = this.getMemory(botId);
    memory.observedMessages = [];
    memory.answerLocked = false;
    memory.chosenAnswer = undefined;
    memory.discussionMessagesThisRound = 0;
    memory.suspectedSnakeIds = [];

    if (role === 'snake') {
      const wrongOptions = OPTION_LABELS.filter((i) => i !== correctIndex);
      memory.defendedAnswerIndex = pickBestWrongAnswer(wrongOptions, question);
      memory.chosenAnswer = 'snake';
    } else {
      memory.defendedAnswerIndex = undefined;
    }

    this.updateMemory(botId, memory);
  }

  /** Sync global chat into this bot's private observed context. */
  syncObservedChat(botId: string, state: GameState): void {
    const memory = this.getMemory(botId);
    const roundMessages = state.chat.filter((m) => m.round === state.round && m.type === 'chat');
    const knownIds = new Set(memory.observedMessages.map((m) => `${m.playerId}:${m.timestamp}`));

    for (const msg of roundMessages) {
      const key = `${msg.playerId}:${msg.timestamp}`;
      if (knownIds.has(key)) continue;
      memory.observedMessages.push({
        playerId: msg.playerId,
        playerName: msg.playerName,
        content: msg.content,
        round: msg.round,
        timestamp: msg.timestamp,
      });
      this.analyzeMessageForBot(botId, msg, state);
    }

    memory.observedMessages = memory.observedMessages.slice(-30);
    this.updateMemory(botId, { observedMessages: memory.observedMessages });
  }

  getRecentMessagesForBot(botId: string, state: GameState): ChatMessage[] {
    this.syncObservedChat(botId, state);
    const memory = this.getMemory(botId);
    return memory.observedMessages.map((m) => ({
      id: `${m.playerId}-${m.timestamp}`,
      playerId: m.playerId,
      playerName: m.playerName,
      playerAvatar: '🦊' as const,
      content: m.content,
      type: 'chat' as const,
      timestamp: m.timestamp,
      round: m.round,
    }));
  }

  maxDiscussionMessages(persona: BotPersona): number {
    const config = PERSONAS[persona];
    return Math.max(2, Math.round(config.chatFrequency * 10));
  }

  shouldContinueDiscussion(
    bot: Player,
    role: RoleType,
    state: GameState,
    phaseEndsAt: number | null
  ): boolean {
    const memory = this.getMemory(bot.id);
    const persona = bot.botPersona ?? 'chaotic_liar';
    const maxMsgs = this.maxDiscussionMessages(persona);

    if (memory.answerLocked) return false;
    if (memory.discussionMessagesThisRound >= maxMsgs) return false;
    if (state.phase !== 'discussion') return false;

    const msLeft = phaseEndsAt ? phaseEndsAt - Date.now() : Infinity;
    if (msLeft < 8000) return false;

    return true;
  }

  evaluateAnswerLock(
    bot: Player,
    role: RoleType,
    state: GameState,
    question: QuizQuestion,
    correctIndex: AnswerIndex,
    phaseEndsAt: number | null
  ): void {
    const memory = this.getMemory(bot.id);
    if (memory.answerLocked) return;

    const persona = bot.botPersona ?? 'chaotic_liar';
    const config = PERSONAS[persona];
    const msgs = memory.discussionMessagesThisRound;
    const msLeft = phaseEndsAt ? phaseEndsAt - Date.now() : Infinity;
    const timePressure = msLeft < 20000;

    if (role === 'snake') {
      const defended = memory.defendedAnswerIndex;
      if (defended === undefined) return;
      const othersMentionDefended = countOthersBackingOption(memory, defended, question);
      const minMsgs = persona === 'silent_strategist' ? 1 : 2;
      if (
        msgs >= minMsgs &&
        (othersMentionDefended >= 1 || msgs >= 4 || timePressure)
      ) {
        memory.answerLocked = true;
        memory.chosenAnswer = 'snake';
        this.updateMemory(bot.id, memory);
      }
      return;
    }

    // Human / mongoose: pick answer then lock when confident or under time pressure
    if (!memory.chosenAnswer || typeof memory.chosenAnswer === 'number') {
      memory.chosenAnswer = this.inferHumanAnswer(bot.id, role, question, correctIndex, state);
    }

    const minMsgs = persona === 'silent_strategist' ? 1 : 2;
    const confidence = role === 'mongoose' ? 0.5 : 0.65 + config.accusationBias * 0.15;
    if (msgs >= minMsgs && (Math.random() < confidence || timePressure || msgs >= 5)) {
      memory.answerLocked = true;
      this.updateMemory(bot.id, memory);
    }
  }

  decideAnswer(
    bot: Player,
    role: RoleType,
    question: QuizQuestion,
    correctIndex: AnswerIndex,
    state: GameState
  ): VoteChoice {
    const memory = this.getMemory(bot.id);
    this.syncObservedChat(bot.id, state);

    if (role === 'snake') {
      return 'snake';
    }

    if (memory.chosenAnswer !== undefined && memory.chosenAnswer !== 'snake') {
      return memory.chosenAnswer;
    }

    return this.inferHumanAnswer(bot.id, role, question, correctIndex, state);
  }

  async decideMessage(
    bot: Player,
    role: RoleType,
    state: GameState,
    accusedBy: string[],
    question?: QuizQuestion,
    correctIndex?: AnswerIndex
  ): Promise<{ message: string; delay: number } | null> {
    const persona = bot.botPersona ?? 'chaotic_liar';
    const config = PERSONAS[persona];
    const memory = this.getMemory(bot.id);

    this.syncObservedChat(bot.id, state);

    if (!this.shouldContinueDiscussion(bot, role, state, state.phaseEndsAt)) {
      if (question && correctIndex !== undefined) {
        this.evaluateAnswerLock(bot, role, state, question, correctIndex, state.phaseEndsAt);
      }
      return null;
    }

    // First message in a round: small chance silent strategist stays quiet once
    if (
      memory.discussionMessagesThisRound === 0 &&
      persona === 'silent_strategist' &&
      Math.random() > config.chatFrequency
    ) {
      return null;
    }

    const recentMessages = this.getRecentMessagesForBot(bot.id, state);
    const alivePlayers = state.players.filter((p) => p.isAlive && !p.isSpectator);
    const primarySuspect = memory.suspectedSnakeIds[0]
      ? alivePlayers.find((p) => p.id === memory.suspectedSnakeIds[0])
      : undefined;

    const ctx: AIContext = {
      botPlayer: bot,
      role,
      persona,
      memory,
      recentMessages,
      alivePlayers,
      round: state.round,
      accusedBy,
      question,
      correctIndex: role === 'snake' ? correctIndex : undefined,
      defendedAnswerIndex: memory.defendedAnswerIndex,
      chosenAnswer: memory.chosenAnswer,
      answerLocked: memory.answerLocked,
      primarySuspectName: primarySuspect?.username,
    };

    const message = await this.provider.generateMessage(ctx);
    const charCount = message.length;
    const delay = Math.floor(
      charCount * ((config.typingSpeed.min + config.typingSpeed.max) / 2) + Math.random() * 1000
    );

    memory.chatHistory.push(message);
    memory.discussionMessagesThisRound += 1;
    this.updateMemory(bot.id, {
      chatHistory: memory.chatHistory.slice(-20),
      discussionMessagesThisRound: memory.discussionMessagesThisRound,
    });

    if (question && correctIndex !== undefined) {
      this.evaluateAnswerLock(bot, role, state, question, correctIndex, state.phaseEndsAt);
    }

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

    if (Math.random() < config.voteRandomness) {
      return alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
    }

    if (role === 'snake' && knownSnakes.length > 0) {
      const nonSnakes = alivePlayers.filter((p) => !knownSnakes.includes(p.id));
      if (nonSnakes.length > 0) {
        const threateningSorted = nonSnakes.sort(
          (a, b) => (memory.perceivedThreat[b.id] ?? 0) - (memory.perceivedThreat[a.id] ?? 0)
        );
        return threateningSorted[0].id;
      }
    }

    if (memory.suspectedSnakeIds.length > 0) {
      const suspect = memory.suspectedSnakeIds.find((id) =>
        alivePlayers.some((p) => p.id === id)
      );
      if (suspect) return suspect;
    }

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

  private inferHumanAnswer(
    botId: string,
    role: RoleType,
    question: QuizQuestion,
    correctIndex: AnswerIndex,
    state: GameState
  ): AnswerIndex {
    const memory = this.getMemory(botId);
    const persona = state.players.find((p) => p.id === botId)?.botPersona ?? 'chaotic_liar';
    const config = PERSONAS[persona];

    // Mongoose doesn't know the answer — guess from discussion or random
    if (role === 'mongoose') {
      const fromChat = inferAnswerFromDiscussion(memory, question);
      if (fromChat !== undefined) return fromChat;
      return OPTION_LABELS[Math.floor(Math.random() * 3)]!;
    }

    // If a snake pushed a wrong answer hard, humans may still pick correct
    const snakePush = memory.defendedAnswerIndex;
    const suspicion = memory.suspectedSnakeIds.length > 0 ? 0.15 : 0;
    const correctChance = 0.6 + config.accusationBias * 0.2 - suspicion;

    if (Math.random() < correctChance) {
      return correctIndex;
    }

    if (snakePush !== undefined && Math.random() < 0.25) {
      return snakePush;
    }

    const wrong = OPTION_LABELS.filter((i) => i !== correctIndex);
    return wrong[Math.floor(Math.random() * wrong.length)]!;
  }

  private analyzeMessageForBot(botId: string, msg: ChatMessage, state: GameState): void {
    const memory = this.getMemory(botId);
    const bot = state.players.find((p) => p.id === botId);
    if (!bot || msg.playerId === botId) return;

    const lower = msg.content.toLowerCase();
    const botName = bot.username.toLowerCase();

    if (lower.includes(botName) && (lower.includes('snake') || lower.includes('sus'))) {
      this.registerAccusation(botId, msg.playerName, state.round);
    }

    if (lower.includes('snake') || lower.includes('lying') || lower.includes('suspicious')) {
      const current = memory.perceivedThreat[msg.playerId] ?? 0;
      memory.perceivedThreat[msg.playerId] = Math.min(1, current + 0.15);
      this.bumpSnakeSuspicion(memory, msg.playerId);
    }

    if (msg.type === 'accusation') {
      memory.accusationsMade.push({ against: msg.playerId, round: state.round });
      this.bumpSnakeSuspicion(memory, msg.playerId);
    }

    this.updateMemory(botId, {
      perceivedThreat: memory.perceivedThreat,
      suspectedSnakeIds: memory.suspectedSnakeIds,
      accusationsMade: memory.accusationsMade,
    });
  }

  private bumpSnakeSuspicion(memory: BotMemory, playerId: string): void {
    memory.suspectedSnakeIds = [
      playerId,
      ...memory.suspectedSnakeIds.filter((id) => id !== playerId),
    ].slice(0, 5);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

/** Snakes pick the wrong option that sounds most plausible (longest text heuristic). */
function pickBestWrongAnswer(wrongOptions: AnswerIndex[], question: QuizQuestion): AnswerIndex {
  return wrongOptions.reduce((best, idx) => {
    const bestLen = question.options[best].length;
    const len = question.options[idx].length;
    if (len > bestLen) return idx;
    if (len === bestLen && Math.random() > 0.5) return idx;
    return best;
  }, wrongOptions[0]!);
}

function countOthersBackingOption(
  memory: BotMemory,
  optionIndex: AnswerIndex,
  question: QuizQuestion
): number {
  const letter = OPTION_LETTERS[optionIndex].toLowerCase();
  const text = question.options[optionIndex].toLowerCase();
  const backers = new Set<string>();

  for (const msg of memory.observedMessages) {
    const lower = msg.content.toLowerCase();
    if (lower.includes(letter) || lower.includes(text.slice(0, 12))) {
      backers.add(msg.playerName);
    }
  }
  return backers.size;
}

function inferAnswerFromDiscussion(
  memory: BotMemory,
  question: QuizQuestion
): AnswerIndex | undefined {
  const scores: Record<AnswerIndex, number> = { 0: 0, 1: 0, 2: 0 };
  for (const msg of memory.observedMessages) {
    const lower = msg.content.toLowerCase();
    for (const idx of OPTION_LABELS) {
      if (
        lower.includes(OPTION_LETTERS[idx].toLowerCase()) ||
        lower.includes(question.options[idx].toLowerCase().slice(0, 10))
      ) {
        scores[idx] += 1;
      }
    }
  }
  const best = OPTION_LABELS.reduce((a, b) => (scores[b] > scores[a] ? b : a), 0 as AnswerIndex);
  return scores[best] > 0 ? best : undefined;
}

function buildSystemPrompt(ctx: AIContext): string {
  const roleDesc =
    ctx.role === 'snake'
      ? 'You are secretly a SNAKE. Mislead humans into picking the WRONG trivia answer. Pick one wrong option and defend it consistently until others agree.'
      : ctx.role === 'mongoose'
        ? 'You are the MONGOOSE. You are not a Snake, but you do not know the correct answer. Debate, spot suspicious players, and pick the best answer you can infer from chat.'
        : 'You are a HUMAN. Find the correct trivia answer and identify Snakes through discussion.';

  const personaDesc: Record<BotPersona, string> = {
    aggressive: 'You are loud, accusatory, and confrontational. You call people out directly.',
    silent_strategist:
      'You are calculating and quiet. You only speak when it matters. Short sentences.',
    chaotic_liar:
      'You are chaotic and unpredictable. You contradict yourself, make jokes, and derail.',
  };

  let strategy = '';
  if (ctx.role === 'snake' && ctx.question && ctx.defendedAnswerIndex !== undefined) {
    const letter = OPTION_LETTERS[ctx.defendedAnswerIndex];
    const text = ctx.question.options[ctx.defendedAnswerIndex];
    strategy = `\nYour secret plan: convince everyone that ${letter} (${text}) is correct. Never admit the real answer. Stick to this line.`;
  } else if (ctx.role !== 'snake' && ctx.primarySuspectName) {
    strategy = `\nYou suspect ${ctx.primarySuspectName} might be a Snake. Press them if they push a bad answer.`;
  }

  if (ctx.answerLocked && ctx.chosenAnswer !== undefined && ctx.chosenAnswer !== 'snake') {
    const letter = OPTION_LETTERS[ctx.chosenAnswer as AnswerIndex];
    strategy += `\nYou have decided on answer ${letter}. Reinforce that choice.`;
  }

  return `You are playing a social deduction game called Snakesss.
${roleDesc}
Persona: ${personaDesc[ctx.persona]}
Round: ${ctx.round}
Players alive: ${ctx.alivePlayers.map((p) => p.username).join(', ')}
Your name: ${ctx.botPlayer.username}
${strategy}

Rules:
- Keep messages under 80 characters
- Never break character
- Never mention game mechanics directly
- Sound human and natural
- Do not use quotation marks around your message`;
}

function buildChatPrompt(ctx: AIContext): string {
  const recent = ctx.recentMessages
    .slice(-8)
    .map((m) => `${m.playerName}: ${m.content}`)
    .join('\n');

  const ownPast = ctx.memory.chatHistory.slice(-3).map((m) => `You (earlier): ${m}`).join('\n');

  const accused =
    ctx.accusedBy.length > 0 ? `You were just accused by: ${ctx.accusedBy.join(', ')}.` : '';

  let questionBlock = '';
  if (ctx.question) {
    const opts = ctx.question.options
      .map((o, i) => `${OPTION_LETTERS[i]}: ${o}`)
      .join(' | ');
    questionBlock = `Question: ${ctx.question.text}\nOptions: ${opts}\n`;
    if (ctx.role === 'snake' && ctx.correctIndex !== undefined) {
      questionBlock += `(Secret: correct is ${OPTION_LETTERS[ctx.correctIndex]} — do NOT reveal this.)\n`;
    }
  }

  return `${questionBlock}Recent chat:\n${recent}\n\nYour prior lines:\n${ownPast}\n\n${accused}\n\nWhat do you say? (one short message, no quotes)`;
}
