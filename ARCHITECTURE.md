# Snakesss — System Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SNAKESSS PLATFORM                          │
├──────────────────┬──────────────────┬──────────────────────────────┤
│   apps/web       │   apps/admin     │      apps/mobile             │
│   (React PWA)    │   (React Admin)  │   (React Native / Expo)      │
│   Port 5173      │   Port 5174      │      iOS / Android           │
│                  │                  │                               │
│  HomeScreen      │  LoginScreen     │   HomeScreen (Expo Router)   │
│  LobbyScreen     │  DashboardScreen │   RoomScreen                 │
│  GameScreen      │  OverviewPanel   │   GlassView                  │
│  ChatPanel       │  RoomListPanel   │   GlassButton                │
│  VotingPanel     │  RoomDetailPanel │   Reanimated @ 120fps        │
│  RoleReveal      │  AnalyticsPanel  │                               │
│  EliminationReveal│                 │                               │
│  GameEndScreen   │                  │                               │
├──────────────────┴──────────────────┴──────────────────────────────┤
│                    Shared Socket.IO Client (socket.io-client)       │
│                    Zustand State Store                              │
├─────────────────────────────────────────────────────────────────────┤
│                          SHARED PACKAGES                            │
├──────────────────────────┬──────────────────────────────────────────┤
│  packages/shared-types   │        packages/game-engine             │
│                          │                                          │
│  GameState               │   GameEngine (state machine)            │
│  Player                  │   ├── assignRoles()                     │
│  Role                    │   ├── transitionToDiscussion()          │
│  ChatMessage             │   ├── transitionToVoting()              │
│  Vote / VoteResult       │   ├── castVote() → auto-advance         │
│  GamePhase enum          │   ├── eliminatePlayer()                 │
│  RoomSettings            │   ├── checkWinCondition()               │
│  ServerToClientEvents    │   └── destroy()                         │
│  ClientToServerEvents    │                                          │
│  AdminState              │   BotDecisionEngine                     │
│  Analytics               │   ├── RuleBasedProvider (fallback)      │
│                          │   ├── XAIProvider (Grok-3-mini)         │
│                          │   └── Persona: aggressive / strategist  │
│                          │         / chaotic_liar                  │
├──────────────────────────┴──────────────────────────────────────────┤
│                           BACKEND SERVER                            │
│                        apps/server (Node.js)                       │
│                                                                     │
│  Express HTTP                 Socket.IO                             │
│  ├── GET  /health             ├── room:create    → RoomManager      │
│  ├── GET  /api/rooms          ├── room:join      → GameEngine       │
│  ├── POST /api/admin/login    ├── room:start     → startGame()      │
│  ├── GET  /api/admin/rooms    ├── chat:send      → addMessage()     │
│  ├── POST /api/admin/pause    ├── vote:cast      → castVote()       │
│  ├── POST /api/admin/bot      ├── admin:action   → AdminActions     │
│  └── Serve web+admin SPA      └── spectate:room  → join room        │
│                                                                     │
│  RoomManager                                                        │
│  ├── rooms: Map<roomId, { engine, botEngine, socketIds, banned }>  │
│  ├── completedGames: CompletedGame[]  (analytics source)           │
│  ├── injectBot(persona) → BotDecisionEngine                        │
│  └── getAdminState() → AdminState                                  │
│                                                                     │
│  Phase Transition Flow:                                             │
│  lobby → dealing (4s) → discussion (timer) → voting (timer)        │
│       → vote_reveal (3s) → elimination (3s) → [win? ended : next  │
│         round → discussion]                                         │
└─────────────────────────────────────────────────────────────────────┘
                           ↕  WebSocket (Socket.IO)
┌─────────────────────────────────────────────────────────────────────┐
│                    RAILWAY DEPLOYMENT (1-click)                     │
│                                                                     │
│  Dockerfile (multi-stage):                                          │
│  Stage 1: deps  (npm install)                                      │
│  Stage 2: builder (tsc all, vite build web+admin)                  │
│  Stage 3: runner (node apps/server/dist/index.js)                  │
│           └── serves web at /                                       │
│           └── serves admin at /admin                               │
│           └── exposes Socket.IO at /socket.io                      │
│                                                                     │
│  ENV:  PORT, JWT_SECRET, ADMIN_PASSWORD, XAI_API_KEY, CLIENT_ORIGIN│
└─────────────────────────────────────────────────────────────────────┘
```

## Game State Schema

```typescript
GameState {
  roomId: string            // 6-char alphanumeric (e.g. "ABC123")
  phase: GamePhase          // lobby | dealing | discussion | voting |
                            //   vote_reveal | elimination | ended
  round: number             // 1-based
  players: Player[]         // all players incl. spectators
  votes: Record<id, id>     // voterId → targetId (current round only)
  roundHistory: RoundVotes[] // full vote history
  chat: ChatMessage[]        // all messages
  winner: 'villagers' | 'snakes' | null
  settings: RoomSettings
  timeline: GameEvent[]      // append-only event log
  phaseEndsAt: number | null // UTC ms for timer
  spectators: string[]       // player IDs
  isPaused: boolean
}
```

## Admin Permission Model

| Action            | Room Manager | Admin (JWT) |
|-------------------|:------------:|:-----------:|
| Update settings   | ✓ (own room) | ✓ (any)     |
| Start game        | ✓            | —           |
| Kick player       | ✓ (own)      | ✓ (any)     |
| Ban player        | —            | ✓           |
| Inject bot        | ✓ (own)      | ✓ (any)     |
| Pause/Resume      | —            | ✓           |
| Close room        | —            | ✓           |
| View analytics    | —            | ✓           |
| Edit roles (test) | —            | ✓           |

## Build Order

1. `packages/shared-types` — TypeScript types, no deps
2. `packages/game-engine` — Pure game logic, depends on shared-types
3. `apps/server` — Backend, depends on game-engine + shared-types
4. `apps/web` — React PWA, depends on shared-types
5. `apps/admin` — React Admin, depends on shared-types
6. `apps/mobile` — React Native/Expo, depends on shared-types + game-engine

## Performance Optimization Checklist

- [x] `will-change: transform` on animated elements (`.gpu` utility)
- [x] `transform: translateZ(0)` for GPU compositing layer promotion
- [x] React Reanimated worklet-based animations (off JS thread on mobile)
- [x] `useSharedValue` + `useAnimatedStyle` for 120fps-eligible animations
- [x] `subscribeWithSelector` Zustand middleware (selector-level re-renders)
- [x] `AnimatePresence` with `mode="wait"` prevents layout thrashing
- [x] Chat scroll uses `scrollIntoView({ behavior: 'smooth' })` not state
- [x] Typing indicator debounced at 1500ms
- [x] Socket events are off React render cycle (no setState in socket handlers)
- [x] Phase timer uses `setInterval(100ms)` not requestAnimationFrame
- [x] Memoized selectors (`selectAlivePlayers`, `selectCanVote`, etc.)
- [x] `React.memo` candidate components: PlayerCard, ChatPanel, Timer
- [x] Framer Motion `layoutId` for tab indicator (no layout recalculation)
- [x] CSS `backdrop-filter` runs on GPU compositor thread
- [x] Socket.IO ping tuned: pingTimeout=10s, pingInterval=5s

## UI Component List

**Shared UI Primitives:**
- `GlassCard` — backdrop-filter frosted glass container
- `Button` — spring-animated, haptic-ready (primary/secondary/danger/ghost)
- `Input` — glass-style text input with error state
- `Timer` — SVG circular countdown, turns red at ≤10s
- `AvatarDisplay` — floating emoji with alive/eliminated state
- `AvatarPicker` — 16-emoji grid selector

**Game Components:**
- `PlayerCard` — role reveal, vote count bar, vote target UI
- `ChatPanel` — message list + typing indicators + message type selector
- `VotingPanel` — player grid with live vote tallies
- `RoleReveal` — 3D card-flip modal with role-specific glow
- `EliminationReveal` — dramatic fullscreen reveal with role
- `CardDeal` — cinematic staggered card dealing animation
- `GameEndScreen` — winner reveal, confetti, vote history, player roles

**Screens:**
- `HomeScreen` — Create/Join with avatar picker
- `LobbyScreen` — Player list, settings panel, share link
- `GameScreen` — Tab-based: Players / Chat / Vote
- `PublicRoomsScreen` — Live room browser with auto-refresh

**Admin:**
- `LoginScreen` — JWT password auth
- `DashboardScreen` — Sidebar nav + nested routes
- `OverviewPanel` — Stat cards + win distribution bar
- `RoomListPanel` — Filterable room list + quick actions
- `RoomDetailPanel` — Full room inspector + chat log + bot injection
- `AnalyticsPanel` — Recharts pie chart + bar chart
