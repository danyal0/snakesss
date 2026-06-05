import fs from 'fs';
import path from 'path';
import type { Analytics } from '@snakesss/shared-types';

export interface CompletedGameRecord {
  roomId: string;
  winner: 'humans' | 'snakes' | null;
  durationMs: number;
  hadBots: boolean;
  startedAt: number;
  recordedAt: number;
}

interface PersistedAnalytics {
  completedGames: CompletedGameRecord[];
}

const DATA_DIR = process.env['DATA_DIR'] ?? path.join(process.cwd(), 'data');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

export class AnalyticsStore {
  private completedGames: CompletedGameRecord[] = [];
  private dirty = false;

  constructor() {
    this.load();
    setInterval(() => this.flush(), 30_000);
  }

  private load(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(ANALYTICS_FILE)) {
        const raw = fs.readFileSync(ANALYTICS_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedAnalytics;
        this.completedGames = parsed.completedGames ?? [];
        console.log(
          `[Analytics] Loaded ${this.completedGames.length} completed game records`
        );
      }
    } catch (e) {
      console.warn('[Analytics] Could not load from disk, starting fresh:', e);
      this.completedGames = [];
    }
  }

  flush(): void {
    if (!this.dirty) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const payload: PersistedAnalytics = { completedGames: this.completedGames };
      fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(payload, null, 2), 'utf-8');
      this.dirty = false;
    } catch (e) {
      console.warn('[Analytics] Could not flush to disk:', e);
    }
  }

  recordCompletedGame(entry: Omit<CompletedGameRecord, 'recordedAt'>): void {
    this.completedGames.push({ ...entry, recordedAt: Date.now() });
    if (this.completedGames.length > 5000) {
      this.completedGames = this.completedGames.slice(-5000);
    }
    this.dirty = true;
    this.flush();
  }

  getCompletedGames(): CompletedGameRecord[] {
    return [...this.completedGames];
  }

  buildAnalytics(activeGames: number, totalPlayers: number): Analytics {
    const total = this.completedGames.length;
    const humanWins = this.completedGames.filter((g) => g.winner === 'humans').length;
    const snakeWins = this.completedGames.filter((g) => g.winner === 'snakes').length;
    const avgDuration =
      total > 0
        ? this.completedGames.reduce((sum, g) => sum + g.durationMs, 0) / total
        : 0;
    const botGames = this.completedGames.filter((g) => g.hadBots);
    const humanGames = this.completedGames.filter((g) => !g.hadBots);

    return {
      totalGames: total,
      activeGames,
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

  clear(): void {
    this.completedGames = [];
    this.dirty = true;
    this.flush();
  }
}

export const analyticsStore = new AnalyticsStore();
