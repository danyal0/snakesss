// ─── Role Types ──────────────────────────────────────────────────────────────

export type RoleType = 'snake' | 'human' | 'mongoose';

export interface Role {
  type: RoleType;
  revealed: boolean;
  eliminatedAt?: number;
}

export interface RoleDistribution {
  snakes: number;
  humans: number;
  mongooses: number; // 0 or 1
}

// ─── Quiz Types ───────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  text: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
}

export type AnswerIndex = 0 | 1 | 2;

/** A/B/C for humans & mongoose, or Snake token for snakes. */
export type VoteChoice = AnswerIndex | 'snake';

export interface PlayerAnswer {
  playerId: string;
  playerName: string;
  playerAvatar: AvatarEmoji;
  answerIndex: AnswerIndex;
  isSnakeVote?: boolean;
  isCorrect: boolean;
  role?: RoleType;
}

export interface RoundScore {
  playerId: string;
  pointsEarned: number;
  totalScore: number;
}

// ─── Player Types ─────────────────────────────────────────────────────────────

export type AvatarEmoji =
  | '🐍' | '🦊' | '🐺' | '🦅' | '🐻' | '🦁' | '🐯' | '🐮'
  | '🦝' | '🦦' | '🦉' | '🐸' | '🦇' | '🐙' | '🦑' | '🐝';

export interface Player {
  id: string;
  username: string;
  avatar: AvatarEmoji;
  isBot: boolean;
  botPersona?: BotPersona;
  isSpectator: boolean;
  isRoomManager: boolean;
  isConnected: boolean;
  isAlive: boolean;
  role?: Role;
  score: number;
  joinedAt: number;
  lastSeenAt: number;
}

// ─── Bot Types ────────────────────────────────────────────────────────────────

export type BotPersona = 'aggressive' | 'silent_strategist' | 'chaotic_liar';

export interface BotObservedMessage {
  playerId: string;
  playerName: string;
  content: string;
  round: number;
  timestamp: number;
}

export interface BotMemory {
  accusationsReceived: Array<{ from: string; round: number }>;
  accusationsMade: Array<{ against: string; round: number }>;
  votesFor: Array<{ target: string; round: number }>;
  perceivedThreat: Record<string, number>;
  chatHistory: string[];
  /** Per-bot log of discussion messages this bot has processed. */
  observedMessages: BotObservedMessage[];
  /** Snake: wrong answer index chosen to push and defend. */
  defendedAnswerIndex?: AnswerIndex;
  /** Locked quiz choice once the bot is done debating. */
  chosenAnswer?: VoteChoice;
  answerLocked: boolean;
  /** Human/mongoose: player ids ranked by snake suspicion. */
  suspectedSnakeIds: string[];
  discussionMessagesThisRound: number;
}

// ─── Game Phase Types ─────────────────────────────────────────────────────────

export type GamePhase =
  | 'lobby'
  | 'dealing'
  | 'question'
  | 'discussion'
  | 'voting'
  | 'answer_reveal'
  | 'vote_reveal'
  | 'elimination'
  | 'scores'          // NEW: round scores shown
  | 'ended';

export type WinCondition = 'humans' | 'snakes' | null;

// ─── Chat Types ───────────────────────────────────────────────────────────────

export type MessageType = 'chat' | 'system' | 'accusation' | 'defense';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerAvatar: AvatarEmoji;
  content: string;
  type: MessageType;
  timestamp: number;
  round: number;
}

export interface TypingIndicator {
  playerId: string;
  playerName: string;
  isTyping: boolean;
}

// ─── Vote Types ───────────────────────────────────────────────────────────────

export interface Vote {
  voterId: string;
  targetId: string;
  round: number;
  timestamp: number;
}

export interface VoteResult {
  targetId: string;
  targetName: string;
  voteCount: number;
  voters: string[];
  isTie: boolean;
}

export interface RoundVotes {
  round: number;
  votes: Vote[];
  result: VoteResult | null;
  eliminatedId: string | null;
}

// ─── Room Settings ────────────────────────────────────────────────────────────

export interface RoomSettings {
  maxPlayers: number;
  botsEnabled: boolean;
  botCount: number;
  discussionTimer: number;
  voteTimer: number;
  questionTimer: number;
  snakePeekTimer: number;
  totalRounds: number;
  roleDistribution: RoleDistribution;
  isPrivate: boolean;
  allowSpectators: boolean;
  advancedRoles: boolean; // enables Mongoose role
  /** Manager-chosen category/topic for AI-generated trivia (empty = any). */
  questionTopic: string;
  /** When true and xAI is configured, generate + quality-gate questions. */
  aiQuestionsEnabled: boolean;
}

// Big Potato role distribution table (always includes Mongoose)
// 4 players: 2 snakes, 1 human, 1 mongoose
// 5 players: 2 snakes, 2 humans, 1 mongoose
// 6 players: 3 snakes, 2 humans, 1 mongoose
// 7 players: 3 snakes, 3 humans, 1 mongoose
// 8 players: 4 snakes, 3 humans, 1 mongoose
export function getOptimalRoleDistribution(playerCount: number): RoleDistribution {
  const table: Record<number, RoleDistribution> = {
    3: { snakes: 1, humans: 2, mongooses: 0 },
    4: { snakes: 2, humans: 1, mongooses: 1 },
    5: { snakes: 2, humans: 2, mongooses: 1 },
    6: { snakes: 3, humans: 2, mongooses: 1 },
    7: { snakes: 3, humans: 3, mongooses: 1 },
    8: { snakes: 4, humans: 3, mongooses: 1 },
    9: { snakes: 4, humans: 4, mongooses: 1 },
    10: { snakes: 5, humans: 4, mongooses: 1 },
    11: { snakes: 5, humans: 5, mongooses: 1 },
    12: { snakes: 6, humans: 5, mongooses: 1 },
  };
  return table[playerCount] ?? table[8]!;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  botsEnabled: false,
  botCount: 0,
  discussionTimer: 120,
  voteTimer: 30,
  questionTimer: 15,
  snakePeekTimer: 15,
  totalRounds: 6,
  roleDistribution: { snakes: 2, humans: 1, mongooses: 1 }, // 4-player default
  isPrivate: false,
  allowSpectators: true,
  advancedRoles: true, // mongoose enabled by default per Big Potato rules
  questionTopic: '',
  aiQuestionsEnabled: true,
};

// ─── Game Event ───────────────────────────────────────────────────────────────

export type GameEventType =
  | 'game_started'
  | 'role_assigned'
  | 'question_shown'
  | 'answer_submitted'
  | 'phase_changed'
  | 'message_sent'
  | 'vote_cast'
  | 'player_eliminated'
  | 'round_scored'
  | 'game_ended'
  | 'player_joined'
  | 'player_left'
  | 'bot_injected'
  | 'game_paused'
  | 'game_resumed'
  | 'admin_action';

export interface GameEvent {
  id: string;
  type: GameEventType;
  payload: Record<string, unknown>;
  timestamp: number;
  round: number;
}

// ─── Full Game State ──────────────────────────────────────────────────────────

export interface GameState {
  roomId: string;
  phase: GamePhase;
  round: number;
  totalRounds: number;
  players: Player[];
  // Quiz
  currentQuestion: QuizQuestion | null;
  answers: Record<string, VoteChoice>;
  answeredPlayerIds?: string[];
  answersRevealed: PlayerAnswer[];               // shown after reveal
  roundScores: Record<number, RoundScore[]>;     // round → scores
  // Elimination
  votes: Record<string, string>;
  roundHistory: RoundVotes[];
  // Chat
  chat: ChatMessage[];
  // End
  winner: WinCondition;
  /** Player id(s) with the highest score when the game ends after all rounds. */
  winnerPlayerIds: string[] | null;
  settings: RoomSettings;
  timeline: GameEvent[];
  phaseEndsAt: number | null;
  spectators: string[];
  isPaused: boolean;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

// ─── Socket Payloads ──────────────────────────────────────────────────────────

/** Browser/device signals for lenient identity (hashed server-side). */
export interface FingerprintSignals {
  userAgent: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  language: string;
  webglVendorHash: string;
  audioFingerprintHash: string;
}

export interface BehavioralSignals {
  joinToActionDelayMs?: number;
  inputCadenceMs?: number;
  interactionRhythm?: number;
}

export interface IdentityClaims {
  fingerprint: FingerprintSignals;
  behavioral?: BehavioralSignals;
  clientTimestamp?: number;
}

export interface JoinRoomPayload {
  roomId: string;
  username: string;
  avatar: AvatarEmoji;
  asSpectator: boolean;
  playerId?: string;
  identity?: IdentityClaims;
}

/** Server join metadata — confidence stays server-side only. */
export interface JoinRoomMeta {
  displayName: string;
  welcomeBack?: boolean;
  nameInUseMessage?: string;
}

export interface CreateRoomPayload {
  username: string;
  avatar: AvatarEmoji;
  settings?: Partial<RoomSettings>;
  /** Recreate a closed room with the same code (manager only, must be available). */
  preferredRoomId?: string;
  identity?: IdentityClaims;
}

export interface SendMessagePayload {
  content: string;
  type: MessageType;
}

export interface CastVotePayload {
  targetId: string;
}

export interface SubmitAnswerPayload {
  answerIndex?: AnswerIndex;
  snakeVote?: boolean;
}

export interface UpdateSettingsPayload {
  settings: Partial<RoomSettings>;
}

export interface AdminActionPayload {
  action: 'kick' | 'ban' | 'inject_bot' | 'pause' | 'resume' | 'edit_role';
  targetId?: string;
  data?: Record<string, unknown>;
}

export interface VoiceSignalPayload {
  targetId: string;
  signal: unknown;
}

export interface VoiceSpeakingPayload {
  playerId: string;
  level: number;
  speaking: boolean;
}

// ─── Socket Events ────────────────────────────────────────────────────────────

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, cb: (roomId: string) => void) => void;
  'room:join': (
    payload: JoinRoomPayload,
    cb: (state: GameState | { error: string }, meta?: JoinRoomMeta) => void
  ) => void;
  'room:leave': () => void;
  'room:start': () => void;
  'room:settings:update': (payload: UpdateSettingsPayload) => void;
  'room:add_bot': (persona: BotPersona, cb: (result: { botId: string } | { error: string }) => void) => void;
  'room:kick': (targetId: string) => void;
  'room:play_again': (cb?: (result: { success: true } | { error: string }) => void) => void;
  'quiz:submit_answer': (payload: SubmitAnswerPayload) => void;
  'chat:send': (payload: SendMessagePayload) => void;
  'chat:typing': (isTyping: boolean) => void;
  'vote:cast': (payload: CastVotePayload) => void;
  'admin:action': (payload: AdminActionPayload) => void;
  'spectate:room': (roomId: string) => void;
  'voice:join': (cb?: (peers: string[]) => void) => void;
  'voice:leave': () => void;
  'voice:signal': (payload: VoiceSignalPayload) => void;
  'voice:speaking': (payload: VoiceSpeakingPayload) => void;
}

export interface ServerToClientEvents {
  'state:full': (state: GameState) => void;
  'state:patch': (patch: Partial<GameState>) => void;
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'player:role': (role: Role, correctAnswer?: AnswerIndex) => void; // snakes get correctAnswer
  'player:snake_peers': (peerIds: string[]) => void;
  'voice:peers': (peerIds: string[]) => void;
  'voice:signal': (fromId: string, signal: unknown) => void;
  'voice:speaking': (payload: VoiceSpeakingPayload) => void;
  'phase:changed': (phase: GamePhase, endsAt: number | null) => void;
  'quiz:question': (question: Omit<QuizQuestion, 'correctIndex'>, snakeAnswer?: AnswerIndex) => void;
  'quiz:answer_update': (count: number, total: number) => void;
  'quiz:reveal': (answers: PlayerAnswer[], correctIndex: AnswerIndex, scores: RoundScore[]) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:typing': (indicator: TypingIndicator) => void;
  'vote:update': (voteCounts: Record<string, number>, castCount: number, totalVoters: number) => void;
  'round:result': (result: RoundVotes) => void;
  'game:ended': (winner: WinCondition, scores: Player[], winnerPlayerIds: string[]) => void;
  'error': (message: string) => void;
  'room:list': (rooms: RoomSummary[]) => void;
  'admin:state': (state: AdminState) => void;
}

// ─── Admin Types ──────────────────────────────────────────────────────────────

export interface RoomSummary {
  roomId: string;
  phase: GamePhase;
  playerCount: number;
  spectatorCount: number;
  createdAt: number;
  startedAt: number | null;
  settings: RoomSettings;
}

export interface AdminState {
  rooms: RoomSummary[];
  analytics: Analytics;
}

export interface Analytics {
  totalGames: number;
  activeGames: number;
  totalPlayers: number;
  avgGameDurationMs: number;
  humanWins: number;
  snakeWins: number;
  aiVsHumanWinRate: { ai: number; human: number };
  votePatternsPerRound: number[];
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatar: AvatarEmoji;
  totalScore: number;       // cumulative across all games
  gamesPlayed: number;
  gamesWon: number;
  bestGameScore: number;    // highest single-game score
  snakeGames: number;       // games played as a snake
  humanGames: number;       // games played as human/mongoose
  lastPlayed: number;       // UTC ms timestamp
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
