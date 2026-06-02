import { Router } from 'express';
import type { GamePhase, RoomSettings } from '@snakesss/shared-types';
import { RoomManager } from './RoomManager';

const E2E_FAST_SETTINGS: Partial<RoomSettings> = {
  discussionTimer: 8,
  voteTimer: 8,
  questionTimer: 4,
  snakePeekTimer: 4,
};

/** Test-only REST helpers — mounted only when E2E_TEST=1 */
export function createE2ETestRouter(
  roomManager: RoomManager,
  broadcastRoom: (roomId: string) => void
): Router {
  const router = Router();

  router.post('/reset', (_req, res) => {
    roomManager.resetAllRooms();
    res.json({ success: true });
  });

  router.post('/seed', (req, res) => {
    const seed = String(req.body?.seed ?? '0');
    roomManager.setTestSeed(seed);
    res.json({ success: true, seed });
  });

  router.post('/rooms', (req, res) => {
    const managerId = `e2e-mgr-${Date.now()}`;
    const username = String(req.body?.username ?? 'E2EHost');
    const avatar = (req.body?.avatar ?? '🦊') as import('@snakesss/shared-types').AvatarEmoji;
    const botCount = Math.min(Number(req.body?.bots ?? 2), 9);
    const fast = req.body?.fastTimers !== false;

    const roomId = roomManager.createRoom(
      managerId,
      username,
      avatar,
      fast ? E2E_FAST_SETTINGS : undefined
    );

    for (let i = 0; i < botCount; i++) {
      roomManager.injectBot(roomId, 'chaotic_liar');
    }

    broadcastRoom(roomId);
    const state = roomManager.getEngine(roomId)?.getState();
    res.json({ success: true, data: { roomId, state } });
  });

  router.post('/rooms/:roomId/start', (req, res) => {
    const roomId = req.params['roomId'] ?? '';
    const engine = roomManager.getEngine(roomId);
    if (!engine) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }
    const result = engine.startGame();
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }
    broadcastRoom(roomId);
    res.json({ success: true, data: engine.getPublicState() });
  });

  router.post('/rooms/:roomId/force-phase', (req, res) => {
    const roomId = req.params['roomId'] ?? '';
    const phase = req.body?.phase as GamePhase;
    const engine = roomManager.getEngine(roomId);
    if (!engine) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }
    engine.forcePhase(phase);
    broadcastRoom(roomId);
    res.json({ success: true, data: engine.getPublicState() });
  });

  router.get('/rooms/:roomId/state', (req, res) => {
    const engine = roomManager.getEngine(req.params['roomId'] ?? '');
    if (!engine) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }
    res.json({ success: true, data: engine.getPublicState() });
  });

  router.post('/rooms/:roomId/error', (req, res) => {
    const roomId = req.params['roomId'] ?? '';
    const engine = roomManager.getEngine(roomId);
    if (!engine) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }
    engine.recordAdminAction('e2e_simulated_error', undefined, {
      message: String(req.body?.message ?? 'Simulated server error'),
    });
    broadcastRoom(roomId);
    res.json({ success: true });
  });

  return router;
}
