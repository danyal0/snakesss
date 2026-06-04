import { BotPersona } from '@snakesss/shared-types';

export interface PersonaConfig {
  name: BotPersona;
  chatFrequency: number;        // 0-1, how often it initiates chat per discussion phase
  accusationBias: number;       // 0-1, tendency to accuse others
  defensiveness: number;        // 0-1, tendency to defend when accused
  voteRandomness: number;       // 0-1, how random/irrational votes can be
  contradictionRate: number;    // 0-1, how often it contradicts past statements
  bluffConfidence: number;      // 0-1, confidence level in bluffing (snakes)
  typingSpeed: { min: number; max: number }; // ms per character
  messageLength: { min: number; max: number };
}

export const PERSONAS: Record<BotPersona, PersonaConfig> = {
  aggressive: {
    name: 'aggressive',
    chatFrequency: 0.9,
    accusationBias: 0.85,
    defensiveness: 0.7,
    voteRandomness: 0.1,
    contradictionRate: 0.15,
    bluffConfidence: 0.8,
    typingSpeed: { min: 40, max: 80 },
    messageLength: { min: 20, max: 80 },
  },
  silent_strategist: {
    name: 'silent_strategist',
    chatFrequency: 0.3,
    accusationBias: 0.4,
    defensiveness: 0.3,
    voteRandomness: 0.05,
    contradictionRate: 0.05,
    bluffConfidence: 0.95,
    typingSpeed: { min: 60, max: 120 },
    messageLength: { min: 10, max: 40 },
  },
  chaotic_liar: {
    name: 'chaotic_liar',
    chatFrequency: 0.7,
    accusationBias: 0.6,
    defensiveness: 0.5,
    voteRandomness: 0.5,
    contradictionRate: 0.6,
    bluffConfidence: 0.4,
    typingSpeed: { min: 30, max: 60 },
    messageLength: { min: 5, max: 60 },
  },
};

export const AGGRESSIVE_PHRASES = [
  "I KNOW {target} is a Snake. The evidence is obvious.",
  "Why is {target} being so quiet? Classic Snake behavior.",
  "{target} voted against me last round — Snake move.",
  "I'm calling it: {target} is lying. Vote them out.",
  "Don't let {target} fool you. I've been watching.",
];

export const DEFENSIVE_PHRASES = [
  "I'm literally a Villager. Why would I lie?",
  "You're all making a huge mistake targeting me.",
  "Fine, vote me out. You'll regret it when the real Snake wins.",
  "I've been trying to help this whole time.",
  "Think about who benefits from me being eliminated.",
];

export const STRATEGIC_PHRASES = [
  "The voting pattern from round {round} is suspicious.",
  "If you look at who voted for whom... it tells a story.",
  "I have a theory but I'm keeping it for now.",
  "Watch {target}. Just watch.",
  "I'll share what I know at the right time.",
];

export const CHAOTIC_PHRASES = [
  "lol who even knows anymore",
  "maybe we're ALL snakes haha",
  "{target} smells funny and that's enough for me",
  "I changed my mind. Vote {target2}. No wait—",
  "chaotic neutral rn not gonna lie",
  "ACTUALLY wait I take everything back",
];

export const VILLAGER_ASSURANCE_PHRASES = [
  "I'm telling you, I checked and I'm clean.",
  "We need to focus. The real Snake is still here.",
  "Let's think logically about the vote patterns.",
  "I trust {player}. They've been consistent.",
];

export const SNAKE_DEFLECTION_PHRASES = [
  "Everyone's so focused on me while the real threat hides.",
  "I wonder why no one is looking at {target}...",
  "Interesting that {target} is so quiet today.",
  "Has anyone noticed {target}'s voting pattern?",
];

export const SNAKE_ANSWER_PUSH_PHRASES = [
  "I'm confident it's {option}. {optionText} — that's the one.",
  "Stop overthinking. {option} is clearly right: {optionText}",
  "I already locked in {option}. {optionText} makes the most sense.",
  "Everyone should pick {option}. I've been saying {optionText} the whole time.",
  "Trust me on {option} — {optionText}. Don't switch now.",
];

export const HUMAN_SNAKE_SUSPECT_PHRASES = [
  "{target} keeps pushing the wrong angle. Snake vibes.",
  "Why is {target} so sure about {option}? Feels like misdirection.",
  "I'm watching {target}. Their story doesn't add up.",
  "{target} deflected when we asked about the answer. Suspicious.",
];

export const HUMAN_ANSWER_CONFIDENCE_PHRASES = [
  "After this chat I'm going with {option}: {optionText}",
  "The group convinced me — {option} ({optionText}) is our play.",
  "Locking {option}. {optionText} survived every objection.",
];
