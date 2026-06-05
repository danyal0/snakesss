# 🐍 Snakesss

A social deduction board game with AI bots, real-time multiplayer, and Apple Liquid Glass UI.

## Stack

| Layer | Technology |
|-------|-----------|
| Game Logic | TypeScript (shared package, no deps) |
| Backend | Node.js + Express + Socket.IO |
| Web | React 18 + Vite + Tailwind CSS + Framer Motion |
| Mobile | React Native + Expo + Reanimated 3 |
| Admin | React 18 + Recharts |
| AI | xAI Grok-3-mini (plug-in, rule-based fallback) |
| Deploy | Railway (one Dockerfile) |

## Quick Start

```bash
# Install
npm install

# Build shared packages
npm run build --workspace=packages/shared-types
npm run build --workspace=packages/game-engine

# Dev (all apps)
npm run dev

# Test
npm test --workspace=packages/game-engine
```

## One-Click Railway Deploy

1. Push to GitHub
2. Connect repo on [railway.app](https://railway.app)
3. Railway detects `railway.json` + `Dockerfile` automatically
4. Set environment variables:

```env
JWT_SECRET=your-long-random-secret
ADMIN_PASSWORD=your-secure-password
XAI_API_KEY=your-xai-key          # optional, enables AI bots
CLIENT_ORIGIN=https://your-app.railway.app
ADMIN_ORIGIN=https://your-app.railway.app
```

5. **Attach a volume** mounted at `/app/data` (persists leaderboard + admin analytics across deploys)
6. Set `DATA_DIR=/app/data` (default in Dockerfile)
7. Deploy → server starts on `:3001`, web on `/`, admin on `/admin`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATA_DIR` | `./data` (local) / `/app/data` (Docker) | Leaderboard + analytics JSON storage |
| `JWT_SECRET` | `snakesss-dev-secret...` | JWT signing key |
| `ADMIN_PASSWORD` | `admin123` | Admin panel password |
| `XAI_API_KEY` | — | xAI API key (AI bots) |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Web app CORS origin |
| `ADMIN_ORIGIN` | `http://localhost:5174` | Admin CORS origin |

## Project Structure

```
snakesss/
├── packages/
│   ├── shared-types/          # TypeScript types (no runtime deps)
│   └── game-engine/           # Game logic + AI bot engine
├── apps/
│   ├── server/                # Node.js + Socket.IO backend
│   ├── web/                   # React PWA (game client)
│   ├── admin/                 # React admin backoffice
│   └── mobile/                # React Native / Expo iOS app
├── Dockerfile                 # Multi-stage production build
├── railway.json               # Railway deployment config
└── ARCHITECTURE.md            # Full system architecture docs
```

## Game Rules

- Players receive secret roles: **Snake** or **Villager** (+ optional **Seer**)
- **Discussion phase**: Real-time chat, accusations, bluffing
- **Voting phase**: Anonymous vote to eliminate one player
- **Elimination**: Role revealed after elimination
- **Villagers win**: All Snakes eliminated
- **Snakes win**: Snakes outnumber Villagers

## AI Bots

Three personas available:
- `aggressive` — loud, accusatory, high chat frequency
- `silent_strategist` — calculates quietly, votes with precision
- `chaotic_liar` — unpredictable, contradicts itself, derails discussions

Set `XAI_API_KEY` to enable Grok-3-mini-powered context-aware responses. Falls back to rule-based generator otherwise.
