import fs from 'fs';
import path from 'path';
import type { LeaderboardEntry, AvatarEmoji, Player } from '@snakesss/shared-types';

interface StoredEntry {
  username: string;
  avatar: AvatarEmoji;
  totalScore: number;
  gamesPlayed: number;
  gamesWon: number;
  bestGameScore: number;
  snakeGames: number;
  humanGames: number;
  lastPlayed: number;
}

type StoredData = Record<string, StoredEntry>;

export interface GameResult {
  players: Player[];
  winner: 'humans' | 'snakes' | null;
}

const DATA_DIR = process.env['DATA_DIR'] ?? path.join(process.cwd(), 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const TOP_N = 10; // store top 10, expose top 5

export class LeaderboardStore {
  private data: StoredData = {};
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    // Flush to disk every 30 seconds if dirty
    setInterval(() => this.flush(), 30_000);
  }

  private load(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(LEADERBOARD_FILE)) {
        const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
        this.data = JSON.parse(raw) as StoredData;
        console.log(`[Leaderboard] Loaded ${Object.keys(this.data).length} entries`);
      }
    } catch (e) {
      console.warn('[Leaderboard] Could not load from disk, starting fresh:', e);
      this.data = {};
    }
  }

  private flush(): void {
    if (!this.dirty) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      this.dirty = false;
    } catch (e) {
      console.warn('[Leaderboard] Could not flush to disk:', e);
    }
  }

  recordGame(result: GameResult): void {
    const { players, winner } = result;

    for (const player of players) {
      if (player.isSpectator || player.isBot) continue; // only real human players

      const key = this.playerKey(player.username);
      const existing = this.data[key] ?? this.newEntry(player);
      const roleType = player.role?.type ?? 'human';
      const isSnakeGame = roleType === 'snake';
      const playerWon =
        (winner === 'humans' && roleType !== 'snake') ||
        (winner === 'snakes' && roleType === 'snake');

      this.data[key] = {
        ...existing,
        username: player.username, // update in case of display name change
        avatar: player.avatar,
        totalScore: existing.totalScore + player.score,
        gamesPlayed: existing.gamesPlayed + 1,
        gamesWon: existing.gamesWon + (playerWon ? 1 : 0),
        bestGameScore: Math.max(existing.bestGameScore, player.score),
        snakeGames: existing.snakeGames + (isSnakeGame ? 1 : 0),
        humanGames: existing.humanGames + (isSnakeGame ? 0 : 1),
        lastPlayed: Date.now(),
      };
    }

    this.dirty = true;
    this.flush(); // flush immediately after a game ends
  }

  getTop(n = 5): LeaderboardEntry[] {
    const entries = Object.values(this.data);
    return entries
      .sort((a, b) => {
        // Primary sort: total score
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        // Tiebreak: win rate
        const aWinRate = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
        const bWinRate = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
        return bWinRate - aWinRate;
      })
      .slice(0, n)
      .map((e, i) => ({
        rank: i + 1,
        username: e.username,
        avatar: e.avatar,
        totalScore: e.totalScore,
        gamesPlayed: e.gamesPlayed,
        gamesWon: e.gamesWon,
        bestGameScore: e.bestGameScore,
        snakeGames: e.snakeGames,
        humanGames: e.humanGames,
        lastPlayed: e.lastPlayed,
      }));
  }

  getPlayerStats(username: string): LeaderboardEntry | null {
    const key = this.playerKey(username);
    const entry = this.data[key];
    if (!entry) return null;

    const sorted = Object.values(this.data).sort(
      (a, b) => b.totalScore - a.totalScore
    );
    const rank = sorted.findIndex((e) => this.playerKey(e.username) === key) + 1;

    return {
      rank,
      username: entry.username,
      avatar: entry.avatar,
      totalScore: entry.totalScore,
      gamesPlayed: entry.gamesPlayed,
      gamesWon: entry.gamesWon,
      bestGameScore: entry.bestGameScore,
      snakeGames: entry.snakeGames,
      humanGames: entry.humanGames,
      lastPlayed: entry.lastPlayed,
    };
  }

  private playerKey(username: string): string {
    return username.toLowerCase().trim();
  }

  private newEntry(player: Player): StoredEntry {
    return {
      username: player.username,
      avatar: player.avatar,
      totalScore: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      bestGameScore: 0,
      snakeGames: 0,
      humanGames: 0,
      lastPlayed: Date.now(),
    };
  }

  // For testing / admin reset
  clear(): void {
    this.data = {};
    this.dirty = true;
    this.flush();
  }

  getStats() {
    return {
      totalPlayers: Object.keys(this.data).length,
      totalGamesRecorded: Object.values(this.data).reduce(
        (sum, e) => sum + e.gamesPlayed, 0
      ) / Math.max(Object.keys(this.data).length, 1),
    };
  }
}

// Singleton
export const leaderboard = new LeaderboardStore();
