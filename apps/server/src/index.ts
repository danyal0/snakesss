import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
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
    origin: [CLIENT_ORIGIN, ADMIN_ORIGIN, /\.railway\.app$/],
    credentials: true,
  },
  pingTimeout: 10000,
  pingInterval: 5000,
});

app.use(cors({ origin: [CLIENT_ORIGIN, ADMIN_ORIGIN, /\.railway\.app$/], credentials: true }));
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

app.use('/api/admin', createAdminRouter(roomManager));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    rooms: roomManager.getRoomList().length,
    uptime: process.uptime(),
  });
});

app.get('/api/rooms', (_req, res) => {
  const publicRooms = roomManager.getRoomList().filter((r) => !r.settings.isPrivate);
  res.json({ success: true, data: publicRooms });
});

// Serve web app static files
const webDist = path.resolve(__dirname, '../../web/dist');
const adminDist = path.resolve(__dirname, '../../admin/dist');

app.use('/admin', express.static(adminDist));
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(adminDist, 'index.html'));
});

app.use(express.static(webDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'));
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Snakesss server running on :${PORT}`);
  console.log(`XAI integration: ${process.env['XAI_API_KEY'] ? 'enabled' : 'rule-based fallback'}`);
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});
