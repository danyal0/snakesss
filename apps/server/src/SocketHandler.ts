import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinRoomPayload,
  CreateRoomPayload,
  GamePhase,
} from '@snakesss/shared-types';
import { RoomManager } from './RoomManager';
import { verifyAdminToken } from './auth';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketMeta {
  playerId?: string;
  roomId?: string;
  isAdmin?: boolean;
}

const socketMeta = new WeakMap<AppSocket, SocketMeta>();

export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  // Wire room state broadcasts
  roomManager.onStateChanged((roomId, state) => {
    io.to(`room:${roomId}`).emit('state:full', state);

    // Emit private role to each player
    state.players.forEach((player) => {
      const role = roomManager.getEngine(roomId)?.getRole(player.id);
      const socketId = roomManager.getSocketId(roomId, player.id);
      if (role && socketId) {
        io.to(socketId).emit('player:role', role);
      }
    });
  });

  roomManager.onPhaseEnded((roomId, phase) => {
    handlePhaseTransition(roomId, phase, io, roomManager);
  });

  io.on('connection', (socket: AppSocket) => {
    socketMeta.set(socket, {});

    socket.on('room:create', async (payload: CreateRoomPayload, cb) => {
      const { username, avatar, settings } = payload;
      const playerId = socket.id;

      const roomId = roomManager.createRoom(playerId, username, avatar, settings);
      const meta = socketMeta.get(socket)!;
      meta.playerId = playerId;
      meta.roomId = roomId;

      roomManager.registerSocket(roomId, playerId, socket.id);
      socket.join(`room:${roomId}`);

      cb(roomId);

      const state = roomManager.getEngine(roomId)?.getState();
      if (state) socket.emit('state:full', state);

      broadcastAdminState(io, roomManager);
    });

    socket.on('room:join', async (payload: JoinRoomPayload, cb) => {
      const { roomId, username, avatar, asSpectator } = payload;
      const playerId = socket.id;

      if (roomManager.isBanned(roomId, playerId)) {
        cb({ error: 'You are banned from this room' });
        return;
      }

      const engine = roomManager.getEngine(roomId);
      if (!engine) {
        cb({ error: 'Room not found' });
        return;
      }

      const result = engine.addPlayer(playerId, username, avatar, asSpectator);
      if (!result.success) {
        cb({ error: result.error ?? 'Failed to join' });
        return;
      }

      const meta = socketMeta.get(socket)!;
      meta.playerId = playerId;
      meta.roomId = roomId;

      roomManager.registerSocket(roomId, playerId, socket.id);
      socket.join(`room:${roomId}`);

      const state = engine.getState();
      cb(state);

      // Notify room
      io.to(`room:${roomId}`).emit('state:full', state);

      broadcastAdminState(io, roomManager);
    });

    socket.on('room:leave', () => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta?.playerId) return;
      handleDisconnect(meta.roomId, meta.playerId, socket, io, roomManager);
    });

    socket.on('room:start', () => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId) return;

      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;

      const state = engine.getState();
      const player = state.players.find((p) => p.id === meta.playerId);
      if (!player?.isRoomManager) {
        socket.emit('error', 'Only the room manager can start the game');
        return;
      }

      const result = engine.startGame();
      if (!result.success) {
        socket.emit('error', result.error ?? 'Could not start game');
        return;
      }

      io.to(`room:${meta.roomId}`).emit('phase:changed', 'dealing', null);
    });

    socket.on('room:settings:update', (payload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId) return;

      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;

      const state = engine.getState();
      const player = state.players.find((p) => p.id === meta.playerId);
      if (!player?.isRoomManager) return;

      engine.updateSettings(payload.settings);
      io.to(`room:${meta.roomId}`).emit('state:full', engine.getState());
    });

    socket.on('chat:send', (payload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta?.playerId) return;

      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;

      const message = engine.addMessage(meta.playerId, payload.content, payload.type);
      if (message) {
        io.to(`room:${meta.roomId}`).emit('chat:message', message);
      }
    });

    socket.on('chat:typing', (isTyping) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta?.playerId) return;

      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;

      const state = engine.getState();
      const player = state.players.find((p) => p.id === meta.playerId);
      if (!player) return;

      socket.to(`room:${meta.roomId}`).emit('chat:typing', {
        playerId: meta.playerId,
        playerName: player.username,
        isTyping,
      });
    });

    socket.on('vote:cast', (payload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta?.playerId) return;

      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;

      const result = engine.castVote(meta.playerId, payload.targetId);
      if (!result.success) {
        socket.emit('error', result.error ?? 'Vote failed');
        return;
      }

      const state = engine.getState();
      io.to(`room:${meta.roomId}`).emit('vote:update', state.votes);
    });

    socket.on('admin:action', (payload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.isAdmin && !isRoomManager(meta, roomManager)) {
        socket.emit('error', 'Unauthorized');
        return;
      }

      handleAdminAction(payload, meta ?? {}, socket, io, roomManager);
    });

    socket.on('spectate:room', (roomId) => {
      socket.join(`room:${roomId}`);
      const engine = roomManager.getEngine(roomId);
      if (engine) {
        socket.emit('state:full', engine.getState());
      }
    });

    socket.on('disconnect', () => {
      const meta = socketMeta.get(socket);
      if (meta?.roomId && meta?.playerId) {
        handleDisconnect(meta.roomId, meta.playerId, socket, io, roomManager);
      }
    });
  });
}

// ─── Phase Transitions ────────────────────────────────────────────────────────

function handlePhaseTransition(
  roomId: string,
  endedPhase: GamePhase,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  const engine = roomManager.getEngine(roomId);
  if (!engine) return;

  const state = engine.getState();
  if (state.isPaused) return;

  switch (endedPhase) {
    case 'dealing':
      engine.transitionToDiscussion();
      scheduleBotChat(roomId, io, roomManager);
      break;

    case 'discussion':
      engine.transitionToVoting();
      scheduleBotVotes(roomId, io, roomManager);
      break;

    case 'voting':
      engine.transitionToVoteReveal();
      break;

    case 'vote_reveal':
      engine.resolveVotes();
      break;

    case 'elimination': {
      const winner = engine.evaluateWin();
      if (winner) {
        engine.endGame(winner);
        const finalState = engine.getState();
        io.to(`room:${roomId}`).emit('game:ended', winner, finalState.timeline);
        const lastRound = finalState.roundHistory[finalState.roundHistory.length - 1];
        if (lastRound) {
          io.to(`room:${roomId}`).emit('round:result', lastRound);
        }
      } else {
        engine.nextRound();
        engine.transitionToDiscussion();
        scheduleBotChat(roomId, io, roomManager);
      }
      break;
    }
  }

  const updatedState = engine.getState();
  io.to(`room:${roomId}`).emit('state:full', updatedState);
  io.to(`room:${roomId}`).emit('phase:changed', updatedState.phase, updatedState.phaseEndsAt);
}

// ─── Bot Scheduling ───────────────────────────────────────────────────────────

async function scheduleBotChat(
  roomId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): Promise<void> {
  const engine = roomManager.getEngine(roomId);
  const botEngine = roomManager.getBotEngine(roomId);
  if (!engine || !botEngine) return;

  const state = engine.getState();
  const bots = state.players.filter((p) => p.isBot && p.isAlive && !p.isSpectator);

  for (const bot of bots) {
    const role = engine.getRole(bot.id);
    if (!role) continue;

    const delay = 2000 + Math.random() * 8000;
    setTimeout(async () => {
      const currentState = engine.getState();
      if (currentState.phase !== 'discussion') return;

      const accusedBy = currentState.chat
        .filter(
          (m) =>
            m.round === currentState.round &&
            (m.content.toLowerCase().includes(bot.username.toLowerCase()) ||
              m.type === 'accusation')
        )
        .map((m) => m.playerName);

      const result = await botEngine.decideMessage(bot, role.type, currentState, accusedBy);
      if (!result) return;

      const currentState2 = engine.getState();
      if (currentState2.phase !== 'discussion') return;

      // Emit typing indicator
      io.to(`room:${roomId}`).emit('chat:typing', {
        playerId: bot.id,
        playerName: bot.username,
        isTyping: true,
      });

      setTimeout(() => {
        const message = engine.addMessage(bot.id, result.message, 'chat');
        if (message) {
          io.to(`room:${roomId}`).emit('chat:message', message);
          io.to(`room:${roomId}`).emit('chat:typing', {
            playerId: bot.id,
            playerName: bot.username,
            isTyping: false,
          });
        }
      }, result.delay);
    }, delay);
  }
}

async function scheduleBotVotes(
  roomId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): Promise<void> {
  const engine = roomManager.getEngine(roomId);
  const botEngine = roomManager.getBotEngine(roomId);
  if (!engine || !botEngine) return;

  const state = engine.getState();
  const bots = state.players.filter((p) => p.isBot && p.isAlive && !p.isSpectator);

  for (const bot of bots) {
    const role = engine.getRole(bot.id);
    if (!role) continue;

    const delay = 1000 + Math.random() * 10000;
    setTimeout(async () => {
      const currentState = engine.getState();
      if (currentState.phase !== 'voting') return;

      const snakeIds = Array.from(engine.getAllRoles().entries())
        .filter(([, r]) => r.type === 'snake')
        .map(([id]) => id);

      const targetId = await botEngine.decideVote(bot, role.type, currentState, snakeIds);
      if (!targetId) return;

      const result = engine.castVote(bot.id, targetId);
      if (result.success) {
        const updatedState = engine.getState();
        io.to(`room:${roomId}`).emit('vote:update', updatedState.votes);
      }
    }, delay);
  }
}

// ─── Admin Actions ────────────────────────────────────────────────────────────

function handleAdminAction(
  payload: Parameters<ClientToServerEvents['admin:action']>[0],
  meta: SocketMeta,
  socket: AppSocket,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  const roomId = payload.data?.['roomId'] as string ?? meta.roomId;
  if (!roomId) return;

  const engine = roomManager.getEngine(roomId);
  if (!engine) return;

  switch (payload.action) {
    case 'kick':
      if (payload.targetId) {
        engine.kickPlayer(payload.targetId);
      }
      break;

    case 'ban':
      if (payload.targetId) {
        roomManager.banPlayer(roomId, payload.targetId);
      }
      break;

    case 'inject_bot': {
      const persona = (payload.data?.['persona'] as string) ?? 'chaotic_liar';
      roomManager.injectBot(roomId, persona as 'aggressive' | 'silent_strategist' | 'chaotic_liar');
      break;
    }

    case 'pause':
      engine.pause();
      io.to(`room:${roomId}`).emit('state:full', engine.getState());
      break;

    case 'resume':
      engine.resume();
      io.to(`room:${roomId}`).emit('state:full', engine.getState());
      break;

    case 'edit_role':
      // Admin role editing for test purposes
      break;
  }

  broadcastAdminState(io, roomManager);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleDisconnect(
  roomId: string,
  playerId: string,
  _socket: AppSocket,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  const engine = roomManager.getEngine(roomId);
  if (!engine) return;

  engine.removePlayer(playerId);
  roomManager.unregisterSocket(roomId, playerId);

  const state = engine.getState();
  const connectedPlayers = state.players.filter((p) => p.isConnected && !p.isSpectator);

  if (connectedPlayers.length === 0 && state.phase === 'lobby') {
    roomManager.closeRoom(roomId);
  } else {
    io.to(`room:${roomId}`).emit('player:left', playerId);
    io.to(`room:${roomId}`).emit('state:full', state);
  }

  broadcastAdminState(io, roomManager);
}

function isRoomManager(meta: SocketMeta | undefined, roomManager: RoomManager): boolean {
  if (!meta?.roomId || !meta?.playerId) return false;
  const state = roomManager.getEngine(meta.roomId)?.getState();
  return state?.players.find((p) => p.id === meta.playerId)?.isRoomManager ?? false;
}

function broadcastAdminState(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  io.to('admin').emit('admin:state', roomManager.getAdminState());
  io.to('admin').emit('room:list', roomManager.getRoomList());
}
