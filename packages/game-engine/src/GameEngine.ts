import {
  GameState,
  GamePhase,
  Player,
  Role,
  ChatMessage,
  GameEvent,
  GameEventType,
  RoomSettings,
  DEFAULT_ROOM_SETTINGS,
  WinCondition,
  AvatarEmoji,
} from '@snakesss/shared-types';
import { assignRoles, checkWinCondition, revealRole } from './roles';
import { buildRoundVotes } from './voting';
import { generateId, generateRoomCode } from './utils';

export interface CreateRoomOptions {
  managerId: string;
  managerName: string;
  managerAvatar: AvatarEmoji;
  settings?: Partial<RoomSettings>;
}

export class GameEngine {
  private state: GameState;
  private roleMap: Map<string, Role> = new Map();
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange?: (state: GameState) => void;
  private onEvent?: (event: GameEvent) => void;
  private onPhaseEnd?: (phase: GamePhase) => void;

  constructor(options: CreateRoomOptions) {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...options.settings,
    };

    const manager: Player = {
      id: options.managerId,
      username: options.managerName,
      avatar: options.managerAvatar,
      isBot: false,
      isSpectator: false,
      isRoomManager: true,
      isConnected: true,
      isAlive: true,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    this.state = {
      roomId: generateRoomCode(),
      phase: 'lobby',
      round: 0,
      players: [manager],
      votes: {},
      roundHistory: [],
      chat: [],
      winner: null,
      settings,
      timeline: [],
      phaseEndsAt: null,
      spectators: [],
      isPaused: false,
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
    };

    this.emit('player_joined', { player: manager });
  }

  // ─── Setters ──────────────────────────────────────────────────────────────

  onStateChanged(cb: (state: GameState) => void): void {
    this.onStateChange = cb;
  }

  onEventEmitted(cb: (event: GameEvent) => void): void {
    this.onEvent = cb;
  }

  onPhaseEnded(cb: (phase: GamePhase) => void): void {
    this.onPhaseEnd = cb;
  }

  // ─── State Access ─────────────────────────────────────────────────────────

  getState(): GameState {
    return { ...this.state };
  }

  getRole(playerId: string): Role | undefined {
    return this.roleMap.get(playerId);
  }

  getAllRoles(): Map<string, Role> {
    return new Map(this.roleMap);
  }

  getRoomId(): string {
    return this.state.roomId;
  }

  // ─── Player Management ────────────────────────────────────────────────────

  addPlayer(
    id: string,
    username: string,
    avatar: AvatarEmoji,
    asSpectator: boolean,
    isBot = false
  ): { success: boolean; error?: string } {
    const { players, settings, phase } = this.state;

    if (phase !== 'lobby') {
      if (!asSpectator && settings.allowSpectators) {
        asSpectator = true;
      } else if (!asSpectator) {
        return { success: false, error: 'Game already in progress' };
      }
    }

    const activePlayers = players.filter((p) => !p.isSpectator);
    if (!asSpectator && activePlayers.length >= settings.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }

    const existing = players.find((p) => p.id === id);
    if (existing) {
      this.updatePlayer(id, { isConnected: true, lastSeenAt: Date.now() });
      return { success: true };
    }

    const player: Player = {
      id,
      username,
      avatar,
      isBot,
      isSpectator: asSpectator,
      isRoomManager: false,
      isConnected: true,
      isAlive: true,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    this.state = {
      ...this.state,
      players: [...players, player],
      spectators: asSpectator
        ? [...this.state.spectators, id]
        : this.state.spectators,
    };

    this.emit('player_joined', { player });
    this.notifyStateChange();
    return { success: true };
  }

  removePlayer(id: string): void {
    this.updatePlayer(id, { isConnected: false, lastSeenAt: Date.now() });
    this.emit('player_left', { playerId: id });
    this.notifyStateChange();
  }

  kickPlayer(id: string): void {
    this.state = {
      ...this.state,
      players: this.state.players.filter((p) => p.id !== id),
    };
    this.emit('player_left', { playerId: id });
    this.notifyStateChange();
  }

  updateSettings(settings: Partial<RoomSettings>): void {
    this.state = {
      ...this.state,
      settings: { ...this.state.settings, ...settings },
    };
    this.notifyStateChange();
  }

  // ─── Game Lifecycle ───────────────────────────────────────────────────────

  startGame(): { success: boolean; error?: string } {
    const activePlayers = this.state.players.filter((p) => !p.isSpectator && p.isConnected);

    if (activePlayers.length < 3) {
      return { success: false, error: 'Need at least 3 players to start' };
    }

    const roles = assignRoles(activePlayers, this.state.settings);
    this.roleMap = roles;

    this.state = {
      ...this.state,
      phase: 'dealing',
      round: 1,
      startedAt: Date.now(),
      players: this.state.players.map((p) => ({ ...p, isAlive: !p.isSpectator })),
    };

    this.emit('game_started', { playerCount: activePlayers.length });
    this.notifyStateChange();

    // Auto-advance from dealing to discussion after animation
    this.schedulePhaseEnd('dealing', 4000);
    return { success: true };
  }

  transitionToDiscussion(): void {
    const endsAt = Date.now() + this.state.settings.discussionTimer * 1000;
    this.state = { ...this.state, phase: 'discussion', phaseEndsAt: endsAt };
    this.emit('phase_changed', { phase: 'discussion', endsAt });
    this.notifyStateChange();
    this.schedulePhaseEnd('discussion', this.state.settings.discussionTimer * 1000);
  }

  transitionToVoting(): void {
    const endsAt = Date.now() + this.state.settings.voteTimer * 1000;
    this.state = { ...this.state, phase: 'voting', votes: {}, phaseEndsAt: endsAt };
    this.emit('phase_changed', { phase: 'voting', endsAt });
    this.notifyStateChange();
    this.schedulePhaseEnd('voting', this.state.settings.voteTimer * 1000);
  }

  transitionToVoteReveal(): void {
    this.state = { ...this.state, phase: 'vote_reveal', phaseEndsAt: null };
    this.clearPhaseTimer();
    this.emit('phase_changed', { phase: 'vote_reveal', endsAt: null });
    this.notifyStateChange();
    this.schedulePhaseEnd('vote_reveal', 3000);
  }

  resolveVotes(): void {
    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);
    const roundVotes = buildRoundVotes(this.state.round, this.state.votes, alivePlayers);

    this.state = {
      ...this.state,
      roundHistory: [...this.state.roundHistory, roundVotes],
    };

    const eliminatedId = roundVotes.eliminatedId;
    if (eliminatedId) {
      this.eliminatePlayer(eliminatedId);
    }
  }

  eliminatePlayer(playerId: string): void {
    const role = this.roleMap.get(playerId);
    if (role) {
      this.roleMap.set(playerId, revealRole(role));
    }

    this.state = {
      ...this.state,
      phase: 'elimination',
      players: this.state.players.map((p) =>
        p.id === playerId ? { ...p, isAlive: false, role: role ? revealRole(role) : undefined } : p
      ),
    };

    this.emit('player_eliminated', { playerId, role: role ? revealRole(role) : null });
    this.notifyStateChange();

    // Check win after elimination
    const winner = this.evaluateWin();
    if (winner) {
      this.schedulePhaseEnd('elimination', 3000);
      return;
    }

    this.schedulePhaseEnd('elimination', 3000);
  }

  evaluateWin(): WinCondition {
    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);
    const winner = checkWinCondition(alivePlayers, this.roleMap);
    return winner;
  }

  endGame(winner: WinCondition): void {
    const allRoles: Player[] = this.state.players.map((p) => ({
      ...p,
      role: this.roleMap.get(p.id) ? revealRole(this.roleMap.get(p.id)!) : p.role,
    }));

    this.state = {
      ...this.state,
      phase: 'ended',
      winner,
      endedAt: Date.now(),
      players: allRoles,
      phaseEndsAt: null,
    };

    this.emit('game_ended', { winner });
    this.clearPhaseTimer();
    this.notifyStateChange();
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────

  addMessage(
    playerId: string,
    content: string,
    type: ChatMessage['type'] = 'chat'
  ): ChatMessage | null {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return null;
    if (!player.isAlive && !player.isSpectator && type !== 'system') return null;
    if (this.state.phase !== 'discussion' && type === 'chat') return null;

    if (content.length > 280) content = content.slice(0, 280);

    const message: ChatMessage = {
      id: generateId('msg'),
      playerId,
      playerName: player.username,
      playerAvatar: player.avatar,
      content,
      type,
      timestamp: Date.now(),
      round: this.state.round,
    };

    this.state = {
      ...this.state,
      chat: [...this.state.chat, message],
    };

    this.emit('message_sent', { message });
    this.notifyStateChange();
    return message;
  }

  // ─── Voting ───────────────────────────────────────────────────────────────

  castVote(voterId: string, targetId: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'voting') {
      return { success: false, error: 'Not in voting phase' };
    }

    const voter = this.state.players.find((p) => p.id === voterId);
    const target = this.state.players.find((p) => p.id === targetId);

    if (!voter?.isAlive || voter.isSpectator) {
      return { success: false, error: 'Cannot vote' };
    }
    if (!target?.isAlive || target.isSpectator) {
      return { success: false, error: 'Invalid target' };
    }
    if (voterId === targetId) {
      return { success: false, error: 'Cannot vote for yourself' };
    }

    this.state = {
      ...this.state,
      votes: { ...this.state.votes, [voterId]: targetId },
    };

    this.emit('vote_cast', { voterId, targetId });
    this.notifyStateChange();

    // Auto-advance if everyone voted
    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);
    const votedCount = Object.keys(this.state.votes).length;
    if (votedCount >= alivePlayers.length) {
      this.clearPhaseTimer();
      this.transitionToVoteReveal();
    }

    return { success: true };
  }

  // ─── Admin Controls ───────────────────────────────────────────────────────

  pause(): void {
    this.state = { ...this.state, isPaused: true };
    this.clearPhaseTimer();
    this.notifyStateChange();
  }

  resume(): void {
    this.state = { ...this.state, isPaused: false };
    this.notifyStateChange();
  }

  nextRound(): void {
    this.state = { ...this.state, round: this.state.round + 1 };
    this.notifyStateChange();
  }

  forcePhase(phase: GamePhase): void {
    switch (phase) {
      case 'discussion': this.transitionToDiscussion(); break;
      case 'voting': this.transitionToVoting(); break;
      case 'vote_reveal': this.transitionToVoteReveal(); break;
      default: break;
    }
  }

  // ─── Internal Helpers ─────────────────────────────────────────────────────

  private updatePlayer(id: string, updates: Partial<Player>): void {
    this.state = {
      ...this.state,
      players: this.state.players.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    };
  }

  private schedulePhaseEnd(phase: GamePhase, delayMs: number): void {
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => {
      if (!this.state.isPaused) {
        this.onPhaseEnd?.(phase);
      }
    }, delayMs);
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  private emit(type: GameEventType, payload: Record<string, unknown>): void {
    const event: GameEvent = {
      id: generateId('evt'),
      type,
      payload,
      timestamp: Date.now(),
      round: this.state.round,
    };
    this.state = {
      ...this.state,
      timeline: [...this.state.timeline, event],
    };
    this.onEvent?.(event);
  }

  private notifyStateChange(): void {
    this.onStateChange?.({ ...this.state });
  }

  destroy(): void {
    this.clearPhaseTimer();
  }
}
