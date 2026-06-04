import type { AnswerIndex, QuizQuestion } from '@snakesss/shared-types';
import { generateId } from './utils';

// ─── Static Question Bank (40+ questions) ────────────────────────────────────

const QUESTION_BANK: Omit<QuizQuestion, 'id'>[] = [
  { text: "Which planet is closest to the Sun?", options: ["Venus", "Mercury", "Mars"], correctIndex: 1 },
  { text: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific"], correctIndex: 2 },
  { text: "How many sides does a hexagon have?", options: ["5", "6", "8"], correctIndex: 1 },
  { text: "Which country has the most natural lakes?", options: ["Russia", "Canada", "USA"], correctIndex: 1 },
  { text: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au"], correctIndex: 2 },
  { text: "Which animal can sleep standing up?", options: ["Cow", "Lion", "Dog"], correctIndex: 0 },
  { text: "How many teeth does an adult human have?", options: ["28", "32", "36"], correctIndex: 1 },
  { text: "Which country invented pizza?", options: ["Greece", "Italy", "Spain"], correctIndex: 1 },
  { text: "What is the fastest land animal?", options: ["Lion", "Cheetah", "Leopard"], correctIndex: 1 },
  { text: "How long does a sloth sleep per day?", options: ["10 hours", "15 hours", "20 hours"], correctIndex: 2 },
  { text: "Which country has the most volcanoes?", options: ["Japan", "Indonesia", "USA"], correctIndex: 1 },
  { text: "What is the hardest natural substance?", options: ["Diamond", "Quartz", "Platinum"], correctIndex: 0 },
  { text: "How many hearts does an octopus have?", options: ["1", "2", "3"], correctIndex: 2 },
  { text: "Which fruit has the most Vitamin C?", options: ["Orange", "Lemon", "Guava"], correctIndex: 2 },
  { text: "What percentage of Earth is covered by water?", options: ["51%", "61%", "71%"], correctIndex: 2 },
  { text: "Which is the longest river in the world?", options: ["Amazon", "Nile", "Mississippi"], correctIndex: 1 },
  { text: "How many bones are in the human body?", options: ["196", "206", "216"], correctIndex: 1 },
  { text: "Which metal is liquid at room temperature?", options: ["Gallium", "Mercury", "Caesium"], correctIndex: 1 },
  { text: "How many strings does a standard guitar have?", options: ["4", "6", "8"], correctIndex: 1 },
  { text: "What is the smallest country in the world?", options: ["Monaco", "San Marino", "Vatican City"], correctIndex: 2 },
  { text: "Which bird cannot fly?", options: ["Parrot", "Penguin", "Pigeon"], correctIndex: 1 },
  { text: "How many players are on a basketball team?", options: ["4", "5", "6"], correctIndex: 1 },
  { text: "What is the currency of Japan?", options: ["Yuan", "Won", "Yen"], correctIndex: 2 },
  { text: "Which element has the chemical symbol 'O'?", options: ["Osmium", "Oxygen", "Oganesson"], correctIndex: 1 },
  { text: "How many days are in a leap year?", options: ["364", "365", "366"], correctIndex: 2 },
  { text: "Which country is home to the kangaroo?", options: ["New Zealand", "Australia", "South Africa"], correctIndex: 1 },
  { text: "What is the largest continent?", options: ["Africa", "Asia", "North America"], correctIndex: 1 },
  { text: "How many colors are in a rainbow?", options: ["6", "7", "8"], correctIndex: 1 },
  { text: "Which instrument has 88 keys?", options: ["Organ", "Piano", "Harpsichord"], correctIndex: 1 },
  { text: "What is the loudest animal on Earth?", options: ["Blue whale", "Sperm whale", "Howler monkey"], correctIndex: 0 },
  { text: "How many legs does a spider have?", options: ["6", "8", "10"], correctIndex: 1 },
  { text: "Which country is the largest by area?", options: ["China", "Canada", "Russia"], correctIndex: 2 },
  { text: "What is the boiling point of water in Celsius?", options: ["90°C", "100°C", "110°C"], correctIndex: 1 },
  { text: "Which planet has the most moons?", options: ["Jupiter", "Saturn", "Neptune"], correctIndex: 1 },
  { text: "How many minutes in a day?", options: ["1,200", "1,440", "1,600"], correctIndex: 1 },
  { text: "What is the most spoken language in the world?", options: ["Spanish", "English", "Mandarin"], correctIndex: 2 },
  { text: "How many chambers does the human heart have?", options: ["2", "3", "4"], correctIndex: 2 },
  { text: "Which is NOT a primary color of light?", options: ["Red", "Green", "Yellow"], correctIndex: 2 },
  { text: "How long is the Great Wall of China?", options: ["5,000 km", "13,000 km", "21,000 km"], correctIndex: 2 },
  { text: "What is the speed of light (approx)?", options: ["200,000 km/s", "300,000 km/s", "400,000 km/s"], correctIndex: 1 },
];

let usedIndices: Set<number> = new Set();

export function getRandomQuestion(): QuizQuestion {
  if (usedIndices.size >= QUESTION_BANK.length) {
    usedIndices.clear();
  }
  let idx: number;
  do {
    idx = Math.floor(Math.random() * QUESTION_BANK.length);
  } while (usedIndices.has(idx));
  usedIndices.add(idx);

  const q = QUESTION_BANK[idx]!;
  return { ...q, id: generateId('q') };
}

export function resetQuestionCycle(): void {
  usedIndices.clear();
}

// ─── Quality gate types ───────────────────────────────────────────────────────

export interface QuestionQualityRating {
  overallScore: number;
  closeAnswersScore: number;
  passes: boolean;
  reason?: string;
}

export interface FetchApprovedQuestionOptions {
  topic?: string;
  usedTopics?: string[];
  maxAttempts?: number;
  minCloseAnswersScore?: number;
  minOverallScore?: number;
}

export const DEFAULT_MIN_CLOSE_ANSWERS_SCORE = 7;
export const DEFAULT_MIN_OVERALL_SCORE = 7;
export const DEFAULT_MAX_QUESTION_ATTEMPTS = 5;

const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions';
const XAI_MODEL = 'grok-3-mini';

// ─── Parsing helpers (testable) ───────────────────────────────────────────────

export function parseQuizQuestionJson(raw: string): QuizQuestion | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned) as {
      text: string;
      options: [string, string, string];
      correctIndex: 0 | 1 | 2;
    };

    if (
      typeof parsed.text === 'string' &&
      parsed.text.trim().length > 0 &&
      Array.isArray(parsed.options) &&
      parsed.options.length === 3 &&
      parsed.options.every((o) => typeof o === 'string' && o.trim().length > 0) &&
      [0, 1, 2].includes(parsed.correctIndex)
    ) {
      return {
        text: parsed.text.trim(),
        options: parsed.options.map((o) => o.trim()) as [string, string, string],
        correctIndex: parsed.correctIndex,
        id: generateId('q'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function parseQuestionQualityJson(raw: string): QuestionQualityRating | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned) as {
      overallScore: number;
      closeAnswersScore: number;
      passes: boolean;
      reason?: string;
    };

    if (
      typeof parsed.overallScore === 'number' &&
      typeof parsed.closeAnswersScore === 'number' &&
      typeof parsed.passes === 'boolean'
    ) {
      return {
        overallScore: clampScore(parsed.overallScore),
        closeAnswersScore: clampScore(parsed.closeAnswersScore),
        passes: parsed.passes,
        reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function meetsQualityThreshold(
  rating: QuestionQualityRating,
  minCloseAnswersScore = DEFAULT_MIN_CLOSE_ANSWERS_SCORE,
  minOverallScore = DEFAULT_MIN_OVERALL_SCORE
): boolean {
  return (
    rating.passes &&
    rating.closeAnswersScore >= minCloseAnswersScore &&
    rating.overallScore >= minOverallScore
  );
}

function clampScore(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

function buildTopicClause(topic?: string, usedTopics: string[] = []): string {
  const parts: string[] = [];
  const trimmed = topic?.trim();
  if (trimmed) {
    parts.push(`The question MUST be about this category/topic: "${trimmed}".`);
  }
  if (usedTopics.length > 0) {
    parts.push(`Avoid repeating these recent topics: ${usedTopics.slice(-5).join(', ')}.`);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

async function xaiChat(apiKey: string, system: string, user: string, maxTokens: number, temperature: number): Promise<string | null> {
  try {
    const res = await fetch(XAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// ─── xAI Question Generator ───────────────────────────────────────────────────

export async function generateAIQuestion(
  apiKey: string,
  usedTopics: string[] = [],
  topic?: string
): Promise<QuizQuestion | null> {
  const topicClause = buildTopicClause(topic, usedTopics);
  const system = `You write trivia for a social deduction party game where players debate which answer is correct.
${topicClause}
Requirements:
- Exactly one objectively correct answer among 3 options.
- Wrong answers must be VERY plausible and CLOSE to the correct one — similar era, category, magnitude, or wording — so players genuinely struggle to pick.
- Avoid joke options, absurd distractors, or answers that are obviously wrong.
Respond ONLY with valid JSON: {"text":"...","options":["A","B","C"],"correctIndex":0} where correctIndex is 0, 1, or 2.`;

  const user = topic?.trim()
    ? `Generate one hard trivia question about: ${topic.trim()}`
    : 'Generate one hard trivia question with very close wrong answers.';

  const raw = await xaiChat(apiKey, system, user, 180, 1.0);
  if (!raw) return null;
  return parseQuizQuestionJson(raw);
}

export async function rateQuestionQuality(
  apiKey: string,
  question: QuizQuestion
): Promise<QuestionQualityRating | null> {
  const labels = ['A', 'B', 'C'] as const;
  const optionsBlock = question.options
    .map((opt, i) => `${labels[i]}: ${opt}${i === question.correctIndex ? ' (CORRECT)' : ''}`)
    .join('\n');

  const system = `You quality-check trivia for a party game. Players must debate which of 3 answers is correct.
STRONG = wrong options are very plausible and close to the correct answer (same ballpark) — genuinely tough to decide.
WEAK = obviously wrong distractors, only one plausible option, trick wording, or ambiguous correct answer.
Respond ONLY with JSON: {"overallScore":1-10,"closeAnswersScore":1-10,"passes":boolean,"reason":"brief"}
Set passes=true ONLY when closeAnswersScore>=7 AND overallScore>=7.`;

  const user = `Question: ${question.text}\nOptions:\n${optionsBlock}\n\nRate difficulty and how close the wrong answers are.`;

  const raw = await xaiChat(apiKey, system, user, 120, 0.2);
  if (!raw) return null;
  return parseQuestionQualityJson(raw);
}

/** Generate and rate questions until one passes quality, or fall back to static bank. */
export async function fetchApprovedQuestion(
  apiKey: string,
  options: FetchApprovedQuestionOptions = {}
): Promise<QuizQuestion> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_QUESTION_ATTEMPTS;
  const minClose = options.minCloseAnswersScore ?? DEFAULT_MIN_CLOSE_ANSWERS_SCORE;
  const minOverall = options.minOverallScore ?? DEFAULT_MIN_OVERALL_SCORE;
  const topic = options.topic?.trim() || undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const question = await generateAIQuestion(apiKey, options.usedTopics ?? [], topic);
    if (!question) continue;

    const rating = await rateQuestionQuality(apiKey, question);
    if (rating && meetsQualityThreshold(rating, minClose, minOverall)) {
      return question;
    }
  }

  return getRandomQuestion();
}
