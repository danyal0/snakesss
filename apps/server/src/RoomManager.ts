import {
  GameState,
  GamePhase,
  RoomSettings,
  AvatarEmoji,
  RoomSummary,
  Analytics,
  AdminState,
  BotPersona,
} from '@snakesss/shared-types';
import { leaderboard } from './LeaderboardStore';
import {
  GameEngine,
  BotDecisionEngine,
  RuleBasedProvider,
  XAIProvider,
} from '@snakesss/game-engine';
import { generateId } from '@snakesss/game-engine';

interface RoomEntry {
  engine: GameEngine;
  botEngine: BotDecisionEngine;
  socketIds: Map<string, string>; // playerId -> socketId
  bannedIds: Set<string>;
  bannedUsernames: Set<string>;
}

function normalizeUsername(username: string): string {
  return username.toLowerCase().trim();
}

interface CompletedGame {
  roomId: string;
  winner: 'humans' | 'snakes' | null;
  durationMs: number;
  hadBots: boolean;
  startedAt: number;
}

/** Keep empty or finished rooms in memory so players can rejoin / play again. */
export const ROOM_CLOSE_DELAY_MS = 60 * 60 * 1000;

export class RoomManager {
  private rooms = new Map<string, RoomEntry>();
  private roomCloseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private completedGames: CompletedGame[] = [];
  private testSeed = '0';
  private aiProvider = this.buildProvider();
  private onRoomStateChange?: (roomId: string, state: GameState) => void;
  private onRoomPhaseEnd?: (roomId: string, phase: GamePhase) => void;
  private onRoomBroadcast?: (roomId: string) => void;

  private buildProvider() {
    const xaiKey = process.env['XAI_API_KEY'];
    return xaiKey
      ? new XAIProvider(xaiKey)
      : new RuleBasedProvider();
  }

  onStateChanged(cb: (roomId: string, state: GameState) => void): void {
    this.onRoomStateChange = cb;
  }

  onPhaseEnded(cb: (roomId: string, phase: GamePhase) => void): void {
    this.onRoomPhaseEnd = cb;
  }

  setRoomBroadcast(cb: (roomId: string) => void): void {
    this.onRoomBroadcast = cb;
  }

  broadcastRoom(roomId: string): void {
    this.onRoomBroadcast?.(roomId);
  }


  createRoom(
    managerId: string,
    managerName: string,
    managerAvatar: AvatarEmoji,
    settings?: Partial<RoomSettings>,
    preferredRoomId?: string
  ): string {
    const preferred = preferredRoomId?.trim().toUpperCase();
    if (preferred && this.rooms.has(preferred)) {
      throw new Error('Room code already in use');
    }

    const botEngine = new BotDecisionEngine(this.aiProvider);
    const xaiApiKey = process.env['XAI_API_KEY'];
    const engine = new GameEngine({
      managerId,
      managerName,
      managerAvatar,
      settings,
      preferredRoomId: preferred,
      xaiApiKey,
    });

    engine.onStateChanged((state) => {
      this.onRoomStateChange?.(state.roomId, state);
    });

    engine.onPhaseEnded((phase) => {
      this.onRoomPhaseEnd?.(engine.getRoomId(), phase);
    });

    const roomId = engine.getRoomId();
    this.cancelScheduledClose(roomId);
    this.rooms.set(roomId, {
      engine,
      botEngine,
      socketIds: new Map(),
      bannedIds: new Set(),
      bannedUsernames: new Set(),
    });

    return roomId;
  }

  scheduleRoomClose(roomId: string, delayMs = ROOM_CLOSE_DELAY_MS): void {
    this.cancelScheduledClose(roomId);
    const timer = setTimeout(() => {
      this.roomCloseTimers.delete(roomId);
      if (this.rooms.has(roomId)) this.closeRoom(roomId);
    }, delayMs);
    this.roomCloseTimers.set(roomId, timer);
  }

  cancelScheduledClose(roomId: string): void {
    const timer = this.roomCloseTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.roomCloseTimers.delete(roomId);
    }
  }

  getRoom(roomId: string): RoomEntry | undefined {
    return this.rooms.get(roomId);
  }

  getEngine(roomId: string): GameEngine | undefined {
    return this.rooms.get(roomId)?.engine;
  }

  getBotEngine(roomId: string): BotDecisionEngine | undefined {
    return this.rooms.get(roomId)?.botEngine;
  }

  registerSocket(roomId: string, playerId: string, socketId: string): void {
    this.rooms.get(roomId)?.socketIds.set(playerId, socketId);
  }

  unregisterSocket(roomId: string, playerId: string): void {
    this.rooms.get(roomId)?.socketIds.delete(playerId);
  }

  getSocketId(roomId: string, playerId: string): string | undefined {
    return this.rooms.get(roomId)?.socketIds.get(playerId);
  }

  isBanned(roomId: string, playerId?: string, username?: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    if (playerId && room.bannedIds.has(playerId)) return true;
    if (username && room.bannedUsernames.has(normalizeUsername(username))) return true;
    return false;
  }

  banPlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.bannedIds.add(playerId);
      const player = room.engine.getState().players.find((p) => p.id === playerId);
      if (player) room.bannedUsernames.add(normalizeUsername(player.username));
      room.engine.kickPlayer(playerId);
    }
  }

  injectBot(
    roomId: string,
    persona: BotPersona = 'chaotic_liar'
  ): string | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const botNames = ['Cipher', 'Ember', 'Vex', 'Nova', 'Rook', 'Jinx', 'Blaze', 'Specter'];
    const botAvatars: AvatarEmoji[] = ['🐍', '🦊', '🐺', '🦅', '🐻', '🦁'];
    const botId = generateId('bot');
    const botName =
      process.env['E2E_TEST'] === '1'
        ? `E2E_${persona}`
        : botNames[Math.floor(Math.random() * botNames.length)] + '_AI';
    const botAvatar = botAvatars[Math.floor(Math.random() * botAvatars.length)];

    const result = room.engine.addPlayer(botId, botName, botAvatar, false, true, persona);
    if (!result.success) return null;

    return botId;
  }

  closeRoom(roomId: string): void {
    this.cancelScheduledClose(roomId);
    const room = this.rooms.get(roomId);
    if (room) {
      const state = room.engine.getState();
      if (state.startedAt) {
        this.completedGames.push({
          roomId,
          winner: state.winner as 'humans' | 'snakes' | null,
          durationMs: (state.endedAt ?? Date.now()) - state.startedAt,
          hadBots: state.players.some((p) => p.isBot),
          startedAt: state.startedAt,
        });
        // Record to persistent leaderboard (only real human players)
        leaderboard.recordGame({
          roomId,
          players: state.players,
          winner: state.winner as 'humans' | 'snakes' | null,
        });
      }
      room.engine.destroy();
      this.rooms.delete(roomId);
    }
  }

  getRoomList(): RoomSummary[] {
    return Array.from(this.rooms.values()).map((r) => {
      const state = r.engine.getState();
      return {
        roomId: state.roomId,
        phase: state.phase,
        playerCount: state.players.filter((p) => !p.isSpectator && p.isConnected).length,
        spectatorCount: state.spectators.length,
        createdAt: state.createdAt,
        startedAt: state.startedAt,
        settings: state.settings,
      };
    });
  }

  getAnalytics(): Analytics {
    const total = this.completedGames.length;
    const active = this.rooms.size;
    const totalPlayers = Array.from(this.rooms.values()).reduce(
      (sum, r) => sum + r.engine.getState().players.filter((p) => !p.isSpectator).length,
      0
    );

    const humanWins = this.completedGames.filter((g) => g.winner === 'humans').length;
    const snakeWins = this.completedGames.filter((g) => g.winner === 'snakes').length;
    const avgDuration = total > 0
      ? this.completedGames.reduce((sum, g) => sum + g.durationMs, 0) / total
      : 0;

    const botGames = this.completedGames.filter((g) => g.hadBots);
    const humanGames = this.completedGames.filter((g) => !g.hadBots);

    return {
      totalGames: total,
      activeGames: active,
      totalPlayers,
      avgGameDurationMs: avgDuration,
      humanWins,
      snakeWins,
      aiVsHumanWinRate: {
        ai: botGames.length,
        human: humanGames.length,
      },
      votePatternsPerRound: [],
    };
  }

  getAdminState(): AdminState {
    return {
      rooms: this.getRoomList(),
      analytics: this.getAnalytics(),
    };
  }

  /** E2E only — tear down every active room */
  resetAllRooms(): void {
    for (const roomId of [...this.rooms.keys()]) {
      this.closeRoom(roomId);
    }
    this.completedGames = [];
  }

  setTestSeed(seed: string): void {
    this.testSeed = seed;
  }

  getTestSeed(): string {
    return this.testSeed;
  }
}
