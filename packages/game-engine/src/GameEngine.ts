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
  QuizQuestion,
  AnswerIndex,
  VoteChoice,
  PlayerAnswer,
  RoundScore,
} from '@snakesss/shared-types';
import { assignRoles, checkWinCondition, revealRole, calculateRoundScores } from './roles';
import { buildRoundVotes } from './voting';
import { generateId, generateRoomCode } from './utils';
import { getRandomQuestion, generateAIQuestion } from './questions';
import { isTimedPhase, sanitizePublicState, sanitizeSpectatorState } from './publicState';

export interface CreateRoomOptions {
  managerId: string;
  managerName: string;
  managerAvatar: AvatarEmoji;
  settings?: Partial<RoomSettings>;
  xaiApiKey?: string;
}

export class GameEngine {
  private state: GameState;
  private roleMap: Map<string, Role> = new Map();
  private answerMap: Map<string, VoteChoice> = new Map(); // hidden until reveal
  private usedQuestionTopics: string[] = [];
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private xaiApiKey?: string;
  private onStateChange?: (state: GameState) => void;
  private onEvent?: (event: GameEvent) => void;
  private onPhaseEnd?: (phase: GamePhase) => void;
  private chatTimestamps = new Map<string, number[]>();
  private static readonly MAX_CHAT = 250;
  private static readonly MAX_TIMELINE = 400;
  private static readonly CHAT_BURST_WINDOW_MS = 10_000;
  private static readonly CHAT_BURST_MAX = 8;
  private static readonly CHAT_MIN_INTERVAL_MS = 400;


  constructor(options: CreateRoomOptions) {
    const settings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      ...options.settings,
    };
    this.xaiApiKey = options.xaiApiKey;

    const manager: Player = {
      id: options.managerId,
      username: options.managerName,
      avatar: options.managerAvatar,
      isBot: false,
      isSpectator: false,
      isRoomManager: true,
      isConnected: true,
      isAlive: true,
      score: 0,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    this.state = {
      roomId: generateRoomCode(),
      phase: 'lobby',
      round: 0,
      totalRounds: settings.totalRounds,
      players: [manager],
      currentQuestion: null,
      answers: {},
      answersRevealed: [],
      roundScores: {},
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

  // ─── Callbacks ────────────────────────────────────────────────────────────

  onStateChanged(cb: (state: GameState) => void): void { this.onStateChange = cb; }
  onEventEmitted(cb: (event: GameEvent) => void): void { this.onEvent = cb; }
  onPhaseEnded(cb: (phase: GamePhase) => void): void { this.onPhaseEnd = cb; }

  // ─── State Access ─────────────────────────────────────────────────────────

  getState(): GameState { return { ...this.state }; }

  getPublicState(): GameState {
    const answeredIds =
      this.state.phase === 'voting' ? Array.from(this.answerMap.keys()) : undefined;
    return sanitizePublicState(this.getState(), answeredIds);
  }

  getSpectatorPublicState(): GameState {
    const answeredIds =
      this.state.phase === 'voting' ? Array.from(this.answerMap.keys()) : undefined;
    return sanitizeSpectatorState(this.getState(), answeredIds);
  }

  getRole(playerId: string): Role | undefined { return this.roleMap.get(playerId); }
  getAllRoles(): Map<string, Role> { return new Map(this.roleMap); }
  getRoomId(): string { return this.state.roomId; }
  getAnswerMap(): Map<string, VoteChoice> { return new Map(this.answerMap); }

  // ─── Player Management ────────────────────────────────────────────────────

  addPlayer(
    id: string,
    username: string,
    avatar: AvatarEmoji,
    asSpectator: boolean,
    isBot = false,
    botPersona?: import('@snakesss/shared-types').BotPersona
  ): { success: boolean; error?: string } {
    const { players, settings, phase } = this.state;

    if (phase !== 'lobby') {
      if (asSpectator) {
        if (!settings.allowSpectators) {
          return { success: false, error: 'Spectators not allowed in this room' };
        }
      } else if (settings.allowSpectators) {
        asSpectator = true;
      } else {
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
      botPersona,
      isSpectator: asSpectator,
      isRoomManager: false,
      isConnected: true,
      isAlive: true,
      score: 0,
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    this.state = {
      ...this.state,
      players: [...players, player],
      spectators: asSpectator ? [...this.state.spectators, id] : this.state.spectators,
    };

    this.emit('player_joined', { player });
    this.notifyStateChange();
    return { success: true };
  }

  removePlayer(id: string): void {
    const leaving = this.state.players.find((p) => p.id === id);
    const wasManager = leaving?.isRoomManager ?? false;

    this.updatePlayer(id, { isConnected: false, lastSeenAt: Date.now() });

    if (wasManager && this.state.phase !== 'ended') {
      const nextManager = this.state.players.find(
        (p) => p.id !== id && p.isConnected && !p.isSpectator
      );
      if (nextManager) {
        this.state = {
          ...this.state,
          players: this.state.players.map((p) => ({
            ...p,
            isRoomManager: p.id === nextManager.id,
          })),
        };
      }
    }

    this.emit('player_left', { playerId: id });
    this.notifyStateChange();
  }

  kickPlayer(id: string): void {
    this.state = { ...this.state, players: this.state.players.filter((p) => p.id !== id) };
    this.emit('player_left', { playerId: id });
    this.notifyStateChange();
  }

  /**
   * Restore a disconnected player with a new socket ID.
   * Called when a player rejoins (page refresh) and is matched by username.
   * The new socketId is the transport identifier but we keep the original player.id
   * for role/score continuity. RoomManager updates the socket registry separately.
   */
  reconnectPlayer(existingPlayerId: string, _newSocketId: string): void {
    this.state = {
      ...this.state,
      players: this.state.players.map((p) =>
        p.id === existingPlayerId
          ? { ...p, isConnected: true, lastSeenAt: Date.now() }
          : p
      ),
    };
    this.notifyStateChange();
  }

  updateSettings(settings: Partial<RoomSettings>): void {
    this.state = { ...this.state, settings: { ...this.state.settings, ...settings } };
    this.notifyStateChange();
  }

  // ─── Game Start ───────────────────────────────────────────────────────────

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
      players: this.state.players.map((p) => ({ ...p, isAlive: !p.isSpectator, score: 0 })),
    };

    this.emit('game_started', { playerCount: activePlayers.length });
    this.notifyStateChange();
    this.schedulePhaseEnd('dealing', 4000);
    return { success: true };
  }

  // ─── Question Phase ───────────────────────────────────────────────────────

  async transitionToQuestion(): Promise<void> {
    const question = this.xaiApiKey
      ? await generateAIQuestion(this.xaiApiKey, this.usedQuestionTopics)
      : getRandomQuestion();

    this.usedQuestionTopics.push(question.text.split(' ').slice(0, 3).join(' '));
    this.answerMap.clear();

    const peekMs = (this.state.settings.snakePeekTimer ?? this.state.settings.questionTimer) * 1000;
    const endsAt = Date.now() + peekMs;
    this.state = {
      ...this.state,
      phase: 'question',
      currentQuestion: question,
      answers: {},
      answersRevealed: [],
      phaseEndsAt: endsAt,
    };

    this.emit('question_shown', { questionId: question.id });
    this.notifyStateChange();
    this.schedulePhaseEnd('question', peekMs);
  }

  submitAnswer(
    playerId: string,
    choice: VoteChoice
  ): { success: boolean; allAnswered?: boolean; error?: string } {
    if (this.state.phase !== 'voting') {
      return { success: false, error: 'Voting is not open yet' };
    }
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player?.isAlive || player.isSpectator) return { success: false, error: 'Cannot vote' };
    if (this.answerMap.has(playerId)) return { success: false, error: 'Already voted' };

    const role = this.roleMap.get(playerId);
    if (!role) return { success: false, error: 'No role' };
    if (role.type === 'snake') {
      if (choice !== 'snake') return { success: false, error: 'Snakes must play the Snake token' };
    } else if (choice === 'snake') {
      return { success: false, error: 'Only snakes can play the Snake token' };
    }

    this.answerMap.set(playerId, choice);
    this.emit('answer_submitted', { playerId });
    this.notifyStateChange();

    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);
    const allAnswered = this.answerMap.size >= alivePlayers.length;
    if (allAnswered) {
      this.clearPhaseTimer();
      this.onPhaseEnd?.('voting');
    }

    return { success: true, allAnswered };
  }

  transitionToAnswerReveal(): void {
    const question = this.state.currentQuestion;
    if (!question) return;

    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);

    // Build revealed answers
    const answersRevealed: PlayerAnswer[] = alivePlayers.map((player) => {
      const choice = this.answerMap.get(player.id);
      const role = this.roleMap.get(player.id);
      if (choice === 'snake' || role?.type === 'snake') {
        return {
          playerId: player.id,
          playerName: player.username,
          playerAvatar: player.avatar,
          answerIndex: question.correctIndex,
          isSnakeVote: true,
          isCorrect: false,
          role: role?.type,
        };
      }
      const answerIndex = (choice ?? 0) as AnswerIndex;
      return {
        playerId: player.id,
        playerName: player.username,
        playerAvatar: player.avatar,
        answerIndex,
        isCorrect: answerIndex === question.correctIndex,
        role: role?.type,
      };
    });

    const revealedAnswers: Record<string, VoteChoice> = {};
    for (const [pid, idx] of this.answerMap.entries()) {
      revealedAnswers[pid] = idx;
    }

    // Calculate scores
    const scoreDeltas = calculateRoundScores(
      this.answerMap,
      question.correctIndex,
      this.roleMap,
      this.state.players
    );

    const updatedPlayers = this.state.players.map((p) => ({
      ...p,
      score: p.score + (scoreDeltas.get(p.id) ?? 0),
    }));

    const roundScoreList: RoundScore[] = Array.from(scoreDeltas.entries()).map(([playerId, pts]) => ({
      playerId,
      pointsEarned: pts,
      totalScore: updatedPlayers.find((p) => p.id === playerId)?.score ?? 0,
    }));

    this.state = {
      ...this.state,
      phase: 'answer_reveal',
      answers: revealedAnswers,
      answersRevealed,
      players: updatedPlayers,
      roundScores: {
        ...this.state.roundScores,
        [this.state.round]: roundScoreList,
      },
      phaseEndsAt: null,
    };

    this.emit('round_scored', { round: this.state.round, scores: roundScoreList });
    this.notifyStateChange();
    this.schedulePhaseEnd('answer_reveal', 5000);
  }

  // ─── Discussion Phase ─────────────────────────────────────────────────────

  transitionToDiscussion(): void {
    const endsAt = Date.now() + this.state.settings.discussionTimer * 1000;
    this.state = { ...this.state, phase: 'discussion', phaseEndsAt: endsAt };
    this.emit('phase_changed', { phase: 'discussion', endsAt });
    this.notifyStateChange();
    this.schedulePhaseEnd('discussion', this.state.settings.discussionTimer * 1000);
  }

  // ─── Voting Phase ─────────────────────────────────────────────────────────

  transitionToVoting(): void {
    this.answerMap.clear();
    const endsAt = Date.now() + this.state.settings.voteTimer * 1000;
    this.state = {
      ...this.state,
      phase: 'voting',
      answers: {},
      answersRevealed: [],
      votes: {},
      phaseEndsAt: endsAt,
    };
    this.emit('phase_changed', { phase: 'voting', endsAt });
    this.notifyStateChange();
    this.schedulePhaseEnd('voting', this.state.settings.voteTimer * 1000);
  }

  transitionToVoteReveal(): void {
    this.state = { ...this.state, phase: 'vote_reveal', phaseEndsAt: null };
    this.clearPhaseTimer();
    this.notifyStateChange();
    this.schedulePhaseEnd('vote_reveal', 3000);
  }

  resolveVotes(): void {
    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);
    const roundVotes = buildRoundVotes(this.state.round, this.state.votes, alivePlayers);
    this.state = { ...this.state, roundHistory: [...this.state.roundHistory, roundVotes] };

    if (roundVotes.eliminatedId) {
      this.eliminatePlayer(roundVotes.eliminatedId);
    } else {
      // No votes cast or all tied with no resolution — skip to scores
      this.transitionToScores();
    }
  }

  eliminatePlayer(playerId: string): void {
    const role = this.roleMap.get(playerId);
    if (role) this.roleMap.set(playerId, revealRole(role));

    this.state = {
      ...this.state,
      phase: 'elimination',
      players: this.state.players.map((p) =>
        p.id === playerId ? { ...p, isAlive: false, role: role ? revealRole(role) : undefined } : p
      ),
    };

    this.emit('player_eliminated', { playerId, role: role ? revealRole(role) : null });
    this.notifyStateChange();
    this.schedulePhaseEnd('elimination', 3500);
  }

  // ─── Scores Phase ─────────────────────────────────────────────────────────

  transitionToScores(): void {
    this.state = { ...this.state, phase: 'scores', phaseEndsAt: null };
    this.notifyStateChange();
    this.schedulePhaseEnd('scores', 4000);
  }

  nextRound(): void {
    const activePlayers = this.state.players.filter(
      (p) => !p.isSpectator && p.isConnected && p.isAlive
    );
    if (activePlayers.length >= 3) {
      this.roleMap = assignRoles(activePlayers, this.state.settings);
    }
    this.state = { ...this.state, round: this.state.round + 1 };
    this.emit('role_assigned', { round: this.state.round });
    this.notifyStateChange();
  }

  // ─── Win Condition ────────────────────────────────────────────────────────

  evaluateWin(): WinCondition {
    return checkWinCondition(
      this.state.players.filter((p) => !p.isSpectator),
      this.roleMap,
      this.state.totalRounds,
      this.state.round
    );
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

    if (type === 'chat' && !player.isSpectator) {
      const now = Date.now();
      const recent = (this.chatTimestamps.get(playerId) ?? []).filter(
        (ts) => now - ts < GameEngine.CHAT_BURST_WINDOW_MS
      );
      if (recent.length >= GameEngine.CHAT_BURST_MAX) return null;
      if (recent.length > 0 && now - recent[recent.length - 1]! < GameEngine.CHAT_MIN_INTERVAL_MS) {
        return null;
      }
      this.chatTimestamps.set(playerId, [...recent, now]);
    }

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

    let chat = [...this.state.chat, message];
    if (chat.length > GameEngine.MAX_CHAT) {
      chat = chat.slice(chat.length - GameEngine.MAX_CHAT);
    }
    this.state = { ...this.state, chat };
    this.emit('message_sent', { message });
    // Do NOT call notifyStateChange here — SocketHandler broadcasts chat:message directly.
    // Emitting state:full for every chat message causes client to receive it before
    // chat:message, then receive chat:message → duplicate message in UI.
    return message;
  }

  // ─── Voting ───────────────────────────────────────────────────────────────

  castVote(voterId: string, targetId: string): { success: boolean; error?: string } {
    if (this.state.phase !== 'voting') return { success: false, error: 'Not in voting phase' };

    const voter = this.state.players.find((p) => p.id === voterId);
    const target = this.state.players.find((p) => p.id === targetId);

    if (!voter?.isAlive || voter.isSpectator) return { success: false, error: 'Cannot vote' };
    if (!target?.isAlive || target.isSpectator) return { success: false, error: 'Invalid target' };
    if (voterId === targetId) return { success: false, error: 'Cannot vote for yourself' };
    if (this.state.votes[voterId]) return { success: false, error: 'Already voted this round' };

    this.state = { ...this.state, votes: { ...this.state.votes, [voterId]: targetId } };
    this.emit('vote_cast', { voterId, targetId });

    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);
    if (Object.keys(this.state.votes).length >= alivePlayers.length) {
      this.clearPhaseTimer();
      this.transitionToVoteReveal();
    } else {
      // Vote tally only — avoid full state:full per vote (performance)
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
    if (!this.state.isPaused) return;
    this.state = { ...this.state, isPaused: false };
    const { phase, phaseEndsAt } = this.state;
    if (phaseEndsAt && isTimedPhase(phase)) {
      const remaining = Math.max(0, phaseEndsAt - Date.now());
      if (remaining > 0) {
        this.schedulePhaseEnd(phase, remaining);
      } else {
        this.onPhaseEnd?.(phase);
      }
    }
    this.notifyStateChange();
  }
  recordAdminAction(action: string, targetId?: string, data?: Record<string, unknown>): void {
    this.emit('admin_action', { action, targetId, data });
  }

  forcePhase(phase: GamePhase): void {
    if (phase === 'discussion') this.transitionToDiscussion();
    else if (phase === 'voting') this.transitionToVoting();
    else if (phase === 'vote_reveal') this.transitionToVoteReveal();
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private updatePlayer(id: string, updates: Partial<Player>): void {
    this.state = {
      ...this.state,
      players: this.state.players.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    };
  }

  private schedulePhaseEnd(phase: GamePhase, delayMs: number): void {
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(() => {
      if (!this.state.isPaused) this.onPhaseEnd?.(phase);
    }, delayMs);
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer) { clearTimeout(this.phaseTimer); this.phaseTimer = null; }
  }

  private emit(type: GameEventType, payload: Record<string, unknown>): void {
    const event: GameEvent = {
      id: generateId('evt'),
      type,
      payload,
      timestamp: Date.now(),
      round: this.state.round,
    };
    let timeline = [...this.state.timeline, event];
    if (timeline.length > GameEngine.MAX_TIMELINE) {
      timeline = timeline.slice(timeline.length - GameEngine.MAX_TIMELINE);
    }
    this.state = { ...this.state, timeline };
    this.onEvent?.(event);
  }

  private notifyStateChange(): void {
    this.onStateChange?.(this.getPublicState());
  }

  destroy(): void { this.clearPhaseTimer(); }
}
