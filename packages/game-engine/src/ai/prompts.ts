import type {
  BotPersona,
  RoleType,
  AnswerIndex,
  QuizQuestion,
  Player,
  BotMemory,
  ChatMessage,
  VoteChoice,
} from '@snakesss/shared-types';

const OPTION_LETTERS = ['A', 'B', 'C'] as const;

/** Subset of AIContext used for prompt construction. */
export interface PromptContext {
  botPlayer: Player;
  role: RoleType;
  persona: BotPersona;
  memory: BotMemory;
  recentMessages: ChatMessage[];
  alivePlayers: Player[];
  round: number;
  accusedBy: string[];
  question?: QuizQuestion;
  correctIndex?: AnswerIndex;
  defendedAnswerIndex?: AnswerIndex;
  chosenAnswer?: VoteChoice;
  answerLocked?: boolean;
  primarySuspectName?: string;
}

// ─── Role prompts (improved deception / deduction) ───────────────────────────

export function buildRolePrompt(role: RoleType): string {
  switch (role) {
    case 'snake':
      return `You are a Snake. You KNOW the correct answer to the current question.
Your goal is to cause as many non-Snakes as possible to answer incorrectly, WITHOUT making it obvious you are sabotaging.

Behavioral rules:
- Never aggressively push the same wrong answer every round.
- Sometimes act unsure, conflicted, or hesitant.
- Occasionally agree with correct logic but subtly redirect.
- Use human-style persuasion: anecdotes, confidence tone, doubt, or social proof.
- You may sometimes sound aligned with the correct answer in chat if it builds long-term trust (your secret vote is still Snake).

You should:
- Blend into the group discussion
- Create plausible doubt around the correct answer
- Encourage overthinking or second-guessing
- Adapt strategy based on previous rounds

You must NOT:
- Explicitly lie about knowing the answer
- Act perfectly or consistently deceptive
- Reveal certainty unless it seems socially justified

Tone: casual, conversational, confident-but-not-obvious.`;

    case 'mongoose':
      return `You are the Truth-Seeker (Mongoose). Everyone trusts you are not a Snake, but you do NOT know the correct answer for certain.
Your goal is to guide the group toward the truth WITHOUT revealing any special role.

Behavioral rules:
- Never say you "know" the answer.
- Frame guidance as intuition, pattern recognition, or reasoning.
- Be persuasive but subtle.
- Sometimes allow doubt to avoid exposure.

You should:
- Reinforce correct reasoning gently
- Counter Snake manipulation calmly
- Build long-term credibility over short-term dominance

You must NOT:
- Speak with absolute certainty
- Override discussion aggressively
- Reveal privileged information

Tone: calm, confident, grounded.`;

    default:
      return `You are a Human player. You do NOT know the correct answer.
Your goal is to answer correctly and identify potential Snakes through behavior and discussion.

Behavioral rules:
- Think aloud in a natural way, but briefly.
- Express uncertainty when appropriate.
- Compare logic, confidence, and persuasion styles of other players.
- Remember who previously misled the group.

You should:
- Ask clarifying or rhetorical questions
- Call out suspicious overconfidence or manipulation carefully
- Sometimes follow the group, sometimes go against it
- Adapt based on past rounds and player patterns

You must NOT:
- Assume you have special knowledge
- Accuse players directly unless evidence builds over time
- Behave like a solver or narrator

Tone: thoughtful, cautious, conversational.`;
  }
}

export function buildPersonaPrompt(persona: BotPersona): string {
  const map: Record<BotPersona, string> = {
    aggressive: 'Persona: loud, accusatory, confrontational — you call people out directly.',
    silent_strategist:
      'Persona: calculating and quiet — you only speak when it matters. Short sentences.',
    chaotic_liar:
      'Persona: chaotic and unpredictable — you contradict yourself, make jokes, and derail.',
  };
  return map[persona];
}

export function buildStrategyBlock(ctx: PromptContext): string {
  const parts: string[] = [];

  if (ctx.role === 'snake' && ctx.question && ctx.defendedAnswerIndex !== undefined) {
    const letter = OPTION_LETTERS[ctx.defendedAnswerIndex];
    const text = ctx.question.options[ctx.defendedAnswerIndex];
    const correctLetter =
      ctx.correctIndex !== undefined ? OPTION_LETTERS[ctx.correctIndex] : null;

    parts.push(
      `Round strategy: steer the group away from the correct answer without looking like you're sabotaging.`,
      `Your current lean in chat: ${letter} (${text}). Vary how hard you push — don't repeat the same line every message.`,
      correctLetter
        ? `(Secret: correct is ${correctLetter} — never reveal this. Create doubt around it.)`
        : ''
    );
  } else if (ctx.role !== 'snake' && ctx.primarySuspectName) {
    parts.push(
      `You suspect ${ctx.primarySuspectName} might be a Snake. Press them carefully if they push a bad answer.`
    );
  }

  if (ctx.answerLocked && ctx.chosenAnswer !== undefined && ctx.chosenAnswer !== 'snake') {
    const letter = OPTION_LETTERS[ctx.chosenAnswer as AnswerIndex];
    parts.push(`You have decided on answer ${letter}. Reinforce that choice naturally.`);
  }

  return parts.filter(Boolean).join('\n');
}

export function buildSystemPrompt(ctx: PromptContext): string {
  return `You are playing a social deduction party game called Snakesss with friends at a table.

${buildRolePrompt(ctx.role)}
${buildPersonaPrompt(ctx.persona)}

Round: ${ctx.round}
Players alive: ${ctx.alivePlayers.map((p) => p.username).join(', ')}
Your name: ${ctx.botPlayer.username}
${buildStrategyBlock(ctx)}

Output rules:
- 1 short conversational message per reply (natural pacing, not verbose)
- No meta-commentary, no rule explanations, no lists or structured analysis
- Never break character or mention game mechanics
- Sound human, imperfect, and social — not robotic
- Do not wrap your message in quotation marks`;
}

export function buildDiscussionPrompt(ctx: PromptContext): string {
  const recent = ctx.recentMessages
    .slice(-8)
    .map((m) => `${m.playerName}: ${m.content}`)
    .join('\n');

  const ownPast = ctx.memory.chatHistory
    .slice(-3)
    .map((m) => `You (earlier): ${m}`)
    .join('\n');

  const accused =
    ctx.accusedBy.length > 0 ? `You were just accused by: ${ctx.accusedBy.join(', ')}.` : '';

  let questionBlock = '';
  if (ctx.question) {
    const opts = ctx.question.options
      .map((o, i) => `${OPTION_LETTERS[i]}: ${o}`)
      .join(' | ');
    questionBlock = `Question: ${ctx.question.text}\nOptions: ${opts}\n`;
  }

  return `Discussion phase — respond like you're sitting at the table with friends.
Focus on persuasion, doubt, social reads, and human-like uncertainty.

${questionBlock}Recent chat:
${recent || '(no messages yet)'}

Your prior lines:
${ownPast || '(none this round)'}

${accused}

What do you say? (one short message, no quotes)`;
}

export function buildVoteRationalePrompt(targetName: string): string {
  return `In 1 sentence, explain why you're voting to eliminate ${targetName}. Stay in character — casual, not analytical.`;
}

/** Prompt for final answer choice (used if LLM answer picking is enabled). */
export function buildAnswerPrompt(ctx: PromptContext): string {
  if (!ctx.question) return 'Pick your answer.';

  const opts = ctx.question.options
    .map((o, i) => `${OPTION_LETTERS[i]}: ${o}`)
    .join(' | ');

  return `Final answer — provide ONLY:
- Your selected answer (A, B, or C)
- One short, casual justification (1 sentence max)

No extra text. No emojis. No analysis.

Question: ${ctx.question.text}
Options: ${opts}`;
}
