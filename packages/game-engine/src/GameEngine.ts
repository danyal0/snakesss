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
  PlayerAnswer,
  RoundScore,
} from '@snakesss/shared-types';
import { assignRoles, checkWinCondition, revealRole, calculateRoundScores } from './roles';
import { buildRoundVotes } from './voting';
import { generateId, generateRoomCode } from './utils';
import { getRandomQuestion, generateAIQuestion } from './questions';

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
  private answerMap: Map<string, AnswerIndex> = new Map(); // hidden until reveal
  private usedQuestionTopics: string[] = [];
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private xaiApiKey?: string;
  private onStateChange?: (state: GameState) => void;
  private onEvent?: (event: GameEvent) => void;
  private onPhaseEnd?: (phase: GamePhase) => void;

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
  getRole(playerId: string): Role | undefined { return this.roleMap.get(playerId); }
  getAllRoles(): Map<string, Role> { return new Map(this.roleMap); }
  getRoomId(): string { return this.state.roomId; }
  getAnswerMap(): Map<string, AnswerIndex> { return new Map(this.answerMap); }

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
    this.updatePlayer(id, { isConnected: false, lastSeenAt: Date.now() });
    this.emit('player_left', { playerId: id });
    this.notifyStateChange();
  }

  kickPlayer(id: string): void {
    this.state = { ...this.state, players: this.state.players.filter((p) => p.id !== id) };
    this.emit('player_left', { playerId: id });
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

    const endsAt = Date.now() + this.state.settings.questionTimer * 1000;
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
    this.schedulePhaseEnd('question', this.state.settings.questionTimer * 1000);
  }

  submitAnswer(playerId: string, answerIndex: AnswerIndex): { success: boolean; allAnswered?: boolean } {
    if (this.state.phase !== 'question') return { success: false };
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player?.isAlive || player.isSpectator) return { success: false };
    if (this.answerMap.has(playerId)) return { success: false }; // already answered

    this.answerMap.set(playerId, answerIndex);
    this.state = {
      ...this.state,
      answers: { ...this.state.answers, [playerId]: answerIndex },
    };
    this.emit('answer_submitted', { playerId });
    this.notifyStateChange();

    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);
    const allAnswered = this.answerMap.size >= alivePlayers.length;
    if (allAnswered) {
      this.clearPhaseTimer();
      this.transitionToAnswerReveal();
    }

    return { success: true, allAnswered };
  }

  transitionToAnswerReveal(): void {
    const question = this.state.currentQuestion;
    if (!question) return;

    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);

    // Build revealed answers
    const answersRevealed: PlayerAnswer[] = alivePlayers.map((player) => {
      const answerIndex = this.answerMap.get(player.id) ?? 0;
      const role = this.roleMap.get(player.id);
      return {
        playerId: player.id,
        playerName: player.username,
        playerAvatar: player.avatar,
        answerIndex,
        isCorrect: answerIndex === question.correctIndex,
        role: role?.type ?? 'human',
      };
    });

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
    const endsAt = Date.now() + this.state.settings.voteTimer * 1000;
    this.state = { ...this.state, phase: 'voting', votes: {}, phaseEndsAt: endsAt };
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
    this.state = { ...this.state, round: this.state.round + 1 };
    this.notifyStateChange();
  }

  // ─── Win Condition ────────────────────────────────────────────────────────

  evaluateWin(): WinCondition {
    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);
    return checkWinCondition(
      alivePlayers,
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

    this.state = { ...this.state, chat: [...this.state.chat, message] };
    this.emit('message_sent', { message });
    this.notifyStateChange();
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

    this.state = { ...this.state, votes: { ...this.state.votes, [voterId]: targetId } };
    this.emit('vote_cast', { voterId, targetId });
    this.notifyStateChange();

    const alivePlayers = this.state.players.filter((p) => p.isAlive && !p.isSpectator);
    if (Object.keys(this.state.votes).length >= alivePlayers.length) {
      this.clearPhaseTimer();
      this.transitionToVoteReveal();
    }

    return { success: true };
  }

  // ─── Admin Controls ───────────────────────────────────────────────────────

  pause(): void { this.state = { ...this.state, isPaused: true }; this.clearPhaseTimer(); this.notifyStateChange(); }
  resume(): void { this.state = { ...this.state, isPaused: false }; this.notifyStateChange(); }
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
    this.state = { ...this.state, timeline: [...this.state.timeline, event] };
    this.onEvent?.(event);
  }

  private notifyStateChange(): void {
    this.onStateChange?.({ ...this.state });
  }

  destroy(): void { this.clearPhaseTimer(); }
}
