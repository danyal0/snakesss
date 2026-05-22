// ─── Role Types ──────────────────────────────────────────────────────────────

export type RoleType = 'snake' | 'villager' | 'seer';

export interface Role {
  type: RoleType;
  revealed: boolean;
  eliminatedAt?: number; // round number
}

export interface RoleDistribution {
  snakes: number;
  villagers: number;
  seers: number;
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
  joinedAt: number;
  lastSeenAt: number;
}

// ─── Bot Types ────────────────────────────────────────────────────────────────

export type BotPersona = 'aggressive' | 'silent_strategist' | 'chaotic_liar';

export interface BotMemory {
  accusationsReceived: Array<{ from: string; round: number }>;
  accusationsMade: Array<{ against: string; round: number }>;
  votesFor: Array<{ target: string; round: number }>;
  perceivedThreat: Record<string, number>; // playerId -> threat level 0-1
  chatHistory: string[];
}

// ─── Game Phase Types ─────────────────────────────────────────────────────────

export type GamePhase =
  | 'lobby'
  | 'dealing'
  | 'discussion'
  | 'voting'
  | 'vote_reveal'
  | 'elimination'
  | 'ended';

export type WinCondition = 'villagers' | 'snakes' | null;

// ─── Chat Types ───────────────────────────────────────────────────────────────

export type MessageType = 'chat' | 'system' | 'accusation' | 'defense';

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerAvatar: AvatarEmoji;
  content: string;
  type: MessageType;
  reaction?: string;
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
  discussionTimer: number;   // seconds
  voteTimer: number;         // seconds
  roleDistribution: RoleDistribution;
  isPrivate: boolean;
  allowSpectators: boolean;
  advancedRoles: boolean;    // enables Seer role
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  botsEnabled: false,
  botCount: 0,
  discussionTimer: 120,
  voteTimer: 30,
  roleDistribution: { snakes: 2, villagers: 5, seers: 0 },
  isPrivate: false,
  allowSpectators: true,
  advancedRoles: false,
};

// ─── Game Event (Timeline) ────────────────────────────────────────────────────

export type GameEventType =
  | 'game_started'
  | 'role_assigned'
  | 'phase_changed'
  | 'message_sent'
  | 'vote_cast'
  | 'player_eliminated'
  | 'game_ended'
  | 'player_joined'
  | 'player_left'
  | 'bot_injected'
  | 'game_paused'
  | 'game_resumed';

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
  players: Player[];
  votes: Record<string, string>;           // voterId -> targetId (current round)
  roundHistory: RoundVotes[];
  chat: ChatMessage[];
  winner: WinCondition;
  settings: RoomSettings;
  timeline: GameEvent[];
  phaseEndsAt: number | null;              // UTC ms timestamp
  spectators: string[];                    // player IDs
  isPaused: boolean;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

// ─── Socket Event Payloads ────────────────────────────────────────────────────

export interface JoinRoomPayload {
  roomId: string;
  username: string;
  avatar: AvatarEmoji;
  asSpectator: boolean;
}

export interface CreateRoomPayload {
  username: string;
  avatar: AvatarEmoji;
  settings?: Partial<RoomSettings>;
}

export interface SendMessagePayload {
  content: string;
  type: MessageType;
}

export interface CastVotePayload {
  targetId: string;
}

export interface UpdateSettingsPayload {
  settings: Partial<RoomSettings>;
}

export interface AdminActionPayload {
  action: 'kick' | 'ban' | 'inject_bot' | 'pause' | 'resume' | 'edit_role';
  targetId?: string;
  data?: Record<string, unknown>;
}

// ─── Socket Events (Client → Server) ─────────────────────────────────────────

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, cb: (roomId: string) => void) => void;
  'room:join': (payload: JoinRoomPayload, cb: (state: GameState | { error: string }) => void) => void;
  'room:leave': () => void;
  'room:start': () => void;
  'room:settings:update': (payload: UpdateSettingsPayload) => void;
  'chat:send': (payload: SendMessagePayload) => void;
  'chat:typing': (isTyping: boolean) => void;
  'vote:cast': (payload: CastVotePayload) => void;
  'admin:action': (payload: AdminActionPayload) => void;
  'spectate:room': (roomId: string) => void;
}

// ─── Socket Events (Server → Client) ─────────────────────────────────────────

export interface ServerToClientEvents {
  'state:full': (state: GameState) => void;
  'state:patch': (patch: Partial<GameState>) => void;
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'player:role': (role: Role) => void;
  'phase:changed': (phase: GamePhase, endsAt: number | null) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:typing': (indicator: TypingIndicator) => void;
  'vote:update': (votes: Record<string, string>) => void;
  'round:result': (result: RoundVotes) => void;
  'game:ended': (winner: WinCondition, timeline: GameEvent[]) => void;
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
  villagerWins: number;
  snakeWins: number;
  aiVsHumanWinRate: { ai: number; human: number };
  votePatternsPerRound: number[];
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
