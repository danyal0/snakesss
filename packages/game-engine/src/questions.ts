import type { QuizQuestion } from '@snakesss/shared-types';
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

// ─── xAI Question Generator ───────────────────────────────────────────────────

export async function generateAIQuestion(
  apiKey: string,
  usedTopics: string[] = []
): Promise<QuizQuestion> {
  const avoidTopics = usedTopics.length > 0
    ? ` Avoid these topics: ${usedTopics.slice(-5).join(', ')}.`
    : '';

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          {
            role: 'system',
            content: `Generate a fun trivia question for a party game. The question should be interesting and have one clearly correct answer.${avoidTopics} Respond ONLY with valid JSON in this exact format: {"text":"...","options":["option A","option B","option C"],"correctIndex":0} where correctIndex is 0, 1, or 2 (zero-indexed position of the correct option). Make the wrong options plausible but clearly wrong.`,
          },
          { role: 'user', content: 'Generate a trivia question.' },
        ],
        max_tokens: 150,
        temperature: 1.0,
      }),
    });

    if (!res.ok) return getRandomQuestion();

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(raw) as {
      text: string;
      options: [string, string, string];
      correctIndex: 0 | 1 | 2;
    };

    if (
      typeof parsed.text === 'string' &&
      Array.isArray(parsed.options) &&
      parsed.options.length === 3 &&
      [0, 1, 2].includes(parsed.correctIndex)
    ) {
      return { ...parsed, id: generateId('q') };
    }
    return getRandomQuestion();
  } catch {
    return getRandomQuestion();
  }
}
