import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { leaderboard } from './LeaderboardStore';
import { RoomManager } from './RoomManager';
import { registerSocketHandlers } from './SocketHandler';
import { createAdminRouter } from './AdminAPI';
import { verifyAdminToken } from './auth';
import type { ClientToServerEvents, ServerToClientEvents } from '@snakesss/shared-types';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const CLIENT_ORIGIN = process.env['CLIENT_ORIGIN'] ?? 'http://localhost:5173';
const ADMIN_ORIGIN = process.env['ADMIN_ORIGIN'] ?? 'http://localhost:5174';

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: [CLIENT_ORIGIN, ADMIN_ORIGIN, /\.railway\.app$/, /localhost/],
    credentials: true,
  },
  pingTimeout: 10000,
  pingInterval: 5000,
});

app.use(cors({
  origin: [CLIENT_ORIGIN, ADMIN_ORIGIN, /\.railway\.app$/, /localhost/],
  credentials: true,
}));
app.use(express.json());

const roomManager = new RoomManager();

// Admin Socket auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth['adminToken'] as string | undefined;
  if (token && verifyAdminToken(token)) {
    socket.join('admin');
    (socket as typeof socket & { isAdmin: boolean }).isAdmin = true;
  }
  next();
});

registerSocketHandlers(io, roomManager);

roomManager.setRoomBroadcast((roomId) => {
  const engine = roomManager.getEngine(roomId);
  if (engine) io.to(`room:${roomId}`).emit('state:full', engine.getPublicState());
});

// ── REST API routes ──────────────────────────────────────────────────────────

app.use('/api/admin', createAdminRouter(roomManager, (roomId) => roomManager.broadcastRoom(roomId)));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: roomManager.getRoomList().length, uptime: process.uptime() });
});

app.get('/api/rooms', (_req, res) => {
  const publicRooms = roomManager.getRoomList().filter((r) => !r.settings.isPrivate);
  res.json({ success: true, data: publicRooms });
});

app.get('/api/leaderboard', (_req, res) => {
  res.json({ success: true, data: leaderboard.getTop(5) });
});

app.get('/api/leaderboard/top/:n', (req, res) => {
  const n = Math.min(parseInt(req.params['n'] ?? '10', 10), 50);
  res.json({ success: true, data: leaderboard.getTop(n) });
});

app.get('/api/leaderboard/player/:username', (req, res) => {
  const entry = leaderboard.getPlayerStats(req.params['username'] ?? '');
  if (!entry) { res.status(404).json({ success: false, error: 'Player not found' }); return; }
  res.json({ success: true, data: entry });
});

// ── Static file serving ──────────────────────────────────────────────────────

const webDist = path.resolve(__dirname, '../../web/dist');
const adminDist = path.resolve(__dirname, '../../admin/dist');

// ── ADMIN at /admin ───────────────────────────────────────────────────────────
// CRITICAL ORDER: explicit SPA routes registered FIRST so Express processes them
// before the static middleware can issue a 301 redirect for /admin (no trailing slash).

// 1. SPA HTML for /admin (exact, no redirect)
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(adminDist, 'index.html'));
});
app.get('/admin/', (_req, res) => {
  res.sendFile(path.join(adminDist, 'index.html'));
});
// 2. Deep SPA routes like /admin/dashboard, /admin/rooms/:id (no file extension)
app.get(/^\/admin\/[^.]*$/, (_req, res) => {
  res.sendFile(path.join(adminDist, 'index.html'));
});
// 3. Static assets (JS, CSS, etc. — have file extensions)
app.use('/admin', express.static(adminDist, { index: false }));

// ── WEB app ───────────────────────────────────────────────────────────────────
app.use(express.static(webDist, { index: false }));
app.get('*', (req, res, next) => {
  // Safety net: never serve the game SPA for admin routes (PWA/misordered routes)
  if (req.path.startsWith('/admin')) {
    const adminIndex = path.join(adminDist, 'index.html');
    res.sendFile(adminIndex, (err) => {
      if (err) next(err);
    });
    return;
  }
  res.sendFile(path.join(webDist, 'index.html'));
});

// ── Server start ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Snakesss server :${PORT}`);
  console.log(`  Web:   ${webDist}`);
  console.log(`  Admin: ${adminDist}`);
  console.log(`  XAI:   ${process.env['XAI_API_KEY'] ? 'enabled' : 'fallback'}`);
});

process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)); });
