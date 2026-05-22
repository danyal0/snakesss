import { Router } from 'express';
import { RoomManager } from './RoomManager';
import { requireAdmin, handleAdminLogin } from './auth';

export function createAdminRouter(roomManager: RoomManager): Router {
  const router = Router();

  router.post('/login', handleAdminLogin);

  router.get('/rooms', requireAdmin, (_req, res) => {
    res.json({ success: true, data: roomManager.getRoomList() });
  });

  router.get('/rooms/:roomId', requireAdmin, (req, res) => {
    const engine = roomManager.getEngine(req.params['roomId'] ?? '');
    if (!engine) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }
    res.json({ success: true, data: engine.getState() });
  });

  router.post('/rooms/:roomId/pause', requireAdmin, (req, res) => {
    const engine = roomManager.getEngine(req.params['roomId'] ?? '');
    if (!engine) { res.status(404).json({ success: false, error: 'Room not found' }); return; }
    engine.pause();
    res.json({ success: true });
  });

  router.post('/rooms/:roomId/resume', requireAdmin, (req, res) => {
    const engine = roomManager.getEngine(req.params['roomId'] ?? '');
    if (!engine) { res.status(404).json({ success: false, error: 'Room not found' }); return; }
    engine.resume();
    res.json({ success: true });
  });

  router.post('/rooms/:roomId/kick/:playerId', requireAdmin, (req, res) => {
    const engine = roomManager.getEngine(req.params['roomId'] ?? '');
    if (!engine) { res.status(404).json({ success: false, error: 'Room not found' }); return; }
    engine.kickPlayer(req.params['playerId'] ?? '');
    res.json({ success: true });
  });

  router.post('/rooms/:roomId/ban/:playerId', requireAdmin, (req, res) => {
    const roomId = req.params['roomId'] ?? '';
    roomManager.banPlayer(roomId, req.params['playerId'] ?? '');
    res.json({ success: true });
  });

  router.post('/rooms/:roomId/bot', requireAdmin, (req, res) => {
    const { persona } = req.body as { persona?: string };
    const botId = roomManager.injectBot(
      req.params['roomId'] ?? '',
      (persona as 'aggressive' | 'silent_strategist' | 'chaotic_liar') ?? 'chaotic_liar'
    );
    if (!botId) { res.status(400).json({ success: false, error: 'Could not inject bot' }); return; }
    res.json({ success: true, data: { botId } });
  });

  router.post('/rooms/:roomId/settings', requireAdmin, (req, res) => {
    const engine = roomManager.getEngine(req.params['roomId'] ?? '');
    if (!engine) { res.status(404).json({ success: false, error: 'Room not found' }); return; }
    engine.updateSettings(req.body);
    res.json({ success: true, data: engine.getState().settings });
  });

  router.post('/rooms/:roomId/close', requireAdmin, (req, res) => {
    roomManager.closeRoom(req.params['roomId'] ?? '');
    res.json({ success: true });
  });

  router.get('/analytics', requireAdmin, (_req, res) => {
    res.json({ success: true, data: roomManager.getAnalytics() });
  });

  router.get('/state', requireAdmin, (_req, res) => {
    res.json({ success: true, data: roomManager.getAdminState() });
  });

  return router;
}
