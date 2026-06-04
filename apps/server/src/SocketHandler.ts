import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinRoomPayload,
  CreateRoomPayload,
  JoinRoomMeta,
  GamePhase,
  AnswerIndex,
  VoiceSignalPayload,
  VoiceSpeakingPayload,
} from '@snakesss/shared-types';
import { buildVoteTally, stripAnswerRoles } from '@snakesss/game-engine';
import { RoomManager } from './RoomManager';
import { leaderboard } from './LeaderboardStore';
import { identityStore, JoinIdentityContext } from './IdentityStore';
import { fallbackIdentityClaims } from './identityFallback';
import { clearRoomBotTimers, scheduleRoomBotTimeout } from './botTimers';
import {
  startBotDiscussion,
  notifyDiscussionChat,
  scheduleBotQuizAnswers,
} from './botDiscussion';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AdminSocket = AppSocket & { isAdmin?: boolean };

interface SocketMeta {
  playerId?: string;
  roomId?: string;
  identityHash?: string;
  displayName?: string;
}

function socketJoinContext(socket: AppSocket): JoinIdentityContext {
  const h = socket.handshake;
  const forwarded = h.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ??
    (h.address as string | undefined) ??
    '0.0.0.0';
  return {
    socketIp: ip,
    country: h.headers['cf-ipcountry'] as string | undefined,
    region: h.headers['x-vercel-ip-country-region'] as string | undefined,
  };
}

const socketMeta = new WeakMap<AppSocket, SocketMeta>();
const voiceParticipants = new Map<string, Set<string>>();

function emitPublicState(
  roomId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  const engine = roomManager.getEngine(roomId);
  if (!engine) return;
  io.to(`room:${roomId}`).emit('state:full', engine.getPublicState());
}

function emitVoteTally(
  roomId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  const engine = roomManager.getEngine(roomId);
  if (!engine) return;
  const internal = engine.getState();
  io.to(`room:${roomId}`).emit(
    'vote:update',
    buildVoteTally(internal.votes),
    Object.keys(internal.votes).length,
    internal.players.filter((p) => p.isAlive && !p.isSpectator).length
  );
}


export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  roomManager.setRoomBroadcast((roomId) => emitPublicState(roomId, io, roomManager));

  // Broadcast state changes — but do NOT emit player:role here (causes repeated role reveals)
  roomManager.onStateChanged((roomId, state) => {
    emitPublicState(roomId, io, roomManager);
  });

  roomManager.onPhaseEnded((roomId, phase) => {
    handlePhaseTransition(roomId, phase, io, roomManager);
  });

  io.on('connection', (socket: AppSocket) => {
    socketMeta.set(socket, {});

    // ── Room: Create ────────────────────────────────────────────────────────
    socket.on('room:create', (_payload: CreateRoomPayload, cb) => {
      const { avatar, settings, preferredRoomId } = _payload;
      const claims = _payload.identity ?? fallbackIdentityClaims(socket.id);
      const playerId = socket.id;

      let roomId: string;
      const pendingRoomId = preferredRoomId?.toUpperCase() ?? 'PENDING';
      const identityResult = identityStore.processJoin(
        _payload.username,
        pendingRoomId,
        claims,
        socketJoinContext(socket)
      );
      const displayName = identityResult.displayName;

      try {
        roomId = roomManager.createRoom(
          playerId,
          displayName,
          avatar,
          settings,
          preferredRoomId
        );
      } catch (e) {
        cb('');
        socket.emit('error', (e as Error).message);
        return;
      }

      identityStore.processJoin(
        _payload.username,
        roomId,
        claims,
        socketJoinContext(socket),
        playerId
      );
      identityStore.linkPlayer(roomId, playerId, identityResult.identityHash);

      const meta = socketMeta.get(socket)!;
      meta.playerId = playerId;
      meta.roomId = roomId;
      meta.identityHash = identityResult.identityHash;
      meta.displayName = displayName;

      roomManager.registerSocket(roomId, playerId, socket.id);
      socket.join(`room:${roomId}`);
      cb(roomId);

      const engineOnCreate = roomManager.getEngine(roomId);
      if (engineOnCreate) socket.emit('state:full', engineOnCreate.getPublicState());

      broadcastAdminState(io, roomManager);
    });

    // ── Room: Join ──────────────────────────────────────────────────────────
    socket.on('room:join', (_payload: JoinRoomPayload, cb) => {
      const { roomId, avatar, asSpectator } = _payload;
      const claims = _payload.identity ?? fallbackIdentityClaims(socket.id);

      if (roomManager.isBanned(roomId, undefined, _payload.username)) {
        cb({ error: 'You are banned from this room' });
        return;
      }

      const engine = roomManager.getEngine(roomId);
      if (!engine) { cb({ error: 'Room not found' }); return; }

      const identityResult = identityStore.processJoin(
        _payload.username,
        roomId,
        claims,
        socketJoinContext(socket),
        _payload.playerId
      );
      const displayName = identityResult.displayName;
      const joinMeta: JoinRoomMeta = {
        displayName,
        welcomeBack: identityResult.welcomeBack,
        nameInUseMessage: identityResult.nameInUseMessage,
      };

      let effectivePlayerId = socket.id;
      const rejoinPlayerId = _payload.playerId;

      if (rejoinPlayerId) {
        const slot = engine.getState().players.find(
          (p) => p.id === rejoinPlayerId && !p.isSpectator
        );
        if (slot) {
          effectivePlayerId = rejoinPlayerId;
          const oldSocketId = roomManager.getSocketId(roomId, rejoinPlayerId);
          if (oldSocketId && oldSocketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(oldSocketId);
            if (oldSocket) {
              const oldMeta = socketMeta.get(oldSocket);
              if (oldMeta) {
                oldMeta.roomId = undefined;
                oldMeta.playerId = undefined;
              }
              oldSocket.disconnect(true);
            }
            roomManager.unregisterSocket(roomId, rejoinPlayerId);
          }
          engine.reconnectPlayer(rejoinPlayerId, socket.id);
        }
      }

      if (effectivePlayerId === socket.id) {
        const normalizedDisplay = displayName.toLowerCase().trim();
        const existingPlayer = engine.getState().players.find(
          (p) =>
            p.username.toLowerCase().trim() === normalizedDisplay &&
            !p.isSpectator &&
            !p.isConnected
        );

        const linked = _payload.playerId
          ? identityStore.getProfileForPlayer(roomId, _payload.playerId)
          : null;
        const canReclaimSlot =
          !existingPlayer ||
          !linked ||
          linked.identityHash === identityResult.identityHash;

        if (existingPlayer && canReclaimSlot) {
          effectivePlayerId = existingPlayer.id;
          engine.reconnectPlayer(existingPlayer.id, socket.id);
        } else if (!existingPlayer) {
          const result = engine.addPlayer(
            socket.id,
            displayName,
            avatar,
            asSpectator
          );
          if (!result.success) {
            cb({ error: result.error ?? 'Failed to join' });
            return;
          }
        } else {
          const result = engine.addPlayer(
            socket.id,
            displayName,
            avatar,
            asSpectator
          );
          if (!result.success) {
            cb({ error: result.error ?? 'Failed to join' });
            return;
          }
        }
      }

      if (roomManager.isBanned(roomId, effectivePlayerId, displayName)) {
        cb({ error: 'You are banned from this room' });
        return;
      }

      identityStore.linkPlayer(roomId, effectivePlayerId, identityResult.identityHash);

      const meta = socketMeta.get(socket)!;
      meta.playerId = effectivePlayerId;
      meta.roomId = roomId;
      meta.identityHash = identityResult.identityHash;
      meta.displayName = displayName;

      roomManager.registerSocket(roomId, effectivePlayerId, socket.id);
      roomManager.cancelScheduledClose(roomId);
      socket.join(`room:${roomId}`);

      const state = engine.getPublicState();
      cb(state, joinMeta);
      emitPublicState(roomId, io, roomManager);

      // Re-send private role to the (re)joining player
      const role = engine.getRole(effectivePlayerId);
      if (role && state.phase !== 'lobby') {
        socket.emit('player:role', role);
        if (role.type === 'snake') {
          emitSnakePeers(roomId, io, roomManager);
        }
      }

      broadcastAdminState(io, roomManager);
    });

    // ── Room: Leave ─────────────────────────────────────────────────────────
    socket.on('room:leave', () => {
      const meta = socketMeta.get(socket);
      if (meta?.roomId && meta?.playerId) {
        handleDisconnect(meta.roomId, meta.playerId, socket, io, roomManager);
      }
    });

    // ── Room: Play again (return to lobby after game over) ───────────────────
    socket.on('room:play_again', (cb) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId) {
        cb?.({ error: 'Not in a room' });
        return;
      }
      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) {
        cb?.({ error: 'Room not found' });
        return;
      }
      const result = engine.returnToLobby();
      if (!result.success) {
        cb?.({ error: result.error ?? 'Cannot return to lobby' });
        return;
      }
      roomManager.cancelScheduledClose(meta.roomId);
      emitPublicState(meta.roomId, io, roomManager);
      broadcastAdminState(io, roomManager);
      cb?.({ success: true });
    });

    // ── Room: Start ─────────────────────────────────────────────────────────
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

      // Emit roles ONCE — only during game start
      emitPrivateRoles(meta.roomId, io, roomManager);

      broadcastAdminState(io, roomManager);
    });

    // ── Room: Settings ──────────────────────────────────────────────────────
    socket.on('room:settings:update', (payload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId) return;
      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;
      const player = engine.getState().players.find((p) => p.id === meta.playerId);
      if (!player?.isRoomManager) return;
      engine.updateSettings(payload.settings);
      emitPublicState(meta.roomId, io, roomManager);
    });

    // ── Room: Add Bot ───────────────────────────────────────────────────────
    socket.on('room:add_bot', (persona, cb) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId) { cb({ error: 'Not in a room' }); return; }
      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) { cb({ error: 'Room not found' }); return; }
      const player = engine.getState().players.find((p) => p.id === meta.playerId);
      if (!player?.isRoomManager) { cb({ error: 'Only room manager can add bots' }); return; }
      const botId = roomManager.injectBot(meta.roomId, persona);
      if (!botId) { cb({ error: 'Could not add bot (room full or game started)' }); return; }
      cb({ botId });
      io.to(`room:${meta.roomId}`).emit('state:full', engine.getState());
      broadcastAdminState(io, roomManager);
    });

    // ── Room: Kick ──────────────────────────────────────────────────────────
    socket.on('room:kick', (targetId) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId) return;
      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;
      const player = engine.getState().players.find((p) => p.id === meta.playerId);
      if (!player?.isRoomManager) return;
      engine.kickPlayer(targetId);
      io.to(`room:${meta.roomId}`).emit('state:full', engine.getState());
    });

    // ── Quiz: Submit Answer ─────────────────────────────────────────────────
    socket.on('quiz:submit_answer', (payload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta?.playerId) return;
      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;

      let choice: import('@snakesss/shared-types').VoteChoice;
      if (payload.snakeVote) {
        choice = 'snake';
      } else if (payload.answerIndex !== undefined) {
        choice = payload.answerIndex as AnswerIndex;
      } else {
        socket.emit('error', 'Invalid vote');
        return;
      }

      const result = engine.submitAnswer(meta.playerId, choice);
      if (!result.success) {
        if (result.error) socket.emit('error', result.error);
        return;
      }

      // Broadcast answer count (not the answer itself) so others see progress
      const state = engine.getState();
      const totalAlive = state.players.filter((p) => p.isAlive && !p.isSpectator).length;
      const answeredCount = engine.getAnswerMap().size;
      io.to(`room:${meta.roomId}`).emit('quiz:answer_update', answeredCount, totalAlive);
    });

    // ── Chat ────────────────────────────────────────────────────────────────
    socket.on('chat:send', (payload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta?.playerId) return;
      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;
      const message = engine.addMessage(meta.playerId, payload.content, payload.type);
      if (message) {
        io.to(`room:${meta.roomId}`).emit('chat:message', message);
        notifyDiscussionChat(meta.roomId, io, roomManager, meta.playerId);
      } else socket.emit('error', 'Message rate limit — slow down');
    });

    // ── Chat: Typing ────────────────────────────────────────────────────────
    socket.on('chat:typing', (isTyping) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta?.playerId) return;
      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;
      const player = engine.getState().players.find((p) => p.id === meta.playerId);
      if (!player) return;
      socket.to(`room:${meta.roomId}`).emit('chat:typing', {
        playerId: meta.playerId,
        playerName: player.username,
        isTyping,
      });
    });

    // ── Vote: Cast ──────────────────────────────────────────────────────────
    socket.on('vote:cast', (payload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta?.playerId) return;
      const engine = roomManager.getEngine(meta.roomId);
      if (!engine) return;
      const result = engine.castVote(meta.playerId, payload.targetId);
      if (!result.success) { socket.emit('error', result.error ?? 'Vote failed'); return; }
      emitVoteTally(meta.roomId, io, roomManager);
    });

    // ── Admin Action (authenticated admin sockets only) ─────────────────────
    socket.on('admin:action', (payload) => {
      if (!(socket as AdminSocket).isAdmin) {
        socket.emit('error', 'Unauthorized admin action');
        return;
      }

      const meta = socketMeta.get(socket) ?? {};
      const roomId = (payload.data?.['roomId'] as string) ?? meta.roomId;
      if (!roomId) return;
      const engine = roomManager.getEngine(roomId);
      if (!engine) return;

      switch (payload.action) {
        case 'kick':
          if (payload.targetId) {
            engine.kickPlayer(payload.targetId);
            engine.recordAdminAction('kick', payload.targetId);
          }
          break;
        case 'ban':
          if (payload.targetId) {
            roomManager.banPlayer(roomId, payload.targetId);
            engine.recordAdminAction('ban', payload.targetId);
          }
          break;
        case 'inject_bot': {
          const persona = payload.data?.['persona'] as string ?? 'chaotic_liar';
          const botId = roomManager.injectBot(roomId, persona as 'aggressive' | 'silent_strategist' | 'chaotic_liar');
          if (botId) engine.recordAdminAction('inject_bot', botId, { persona });
          break;
        }
        case 'pause':
          clearRoomBotTimers(roomId);
          engine.pause();
          engine.recordAdminAction('pause');
          break;
        case 'resume':
          engine.resume();
          engine.recordAdminAction('resume');
          break;
      }
      emitPublicState(roomId, io, roomManager);
      broadcastAdminState(io, roomManager);
    });

    socket.on('voice:join', (cb) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta.playerId) {
        cb?.([]);
        return;
      }
      const { roomId, playerId } = meta;
      if (!voiceParticipants.has(roomId)) voiceParticipants.set(roomId, new Set());
      voiceParticipants.get(roomId)!.add(playerId);
      const peers = [...voiceParticipants.get(roomId)!].filter((id) => id !== playerId);
      socket.to(`room:${roomId}`).emit('voice:peers', peers.concat(playerId));
      cb?.(peers);
    });

    socket.on('voice:leave', () => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta.playerId) return;
      removeVoiceParticipant(meta.roomId, meta.playerId, io);
    });

    socket.on('voice:signal', (payload: VoiceSignalPayload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta.playerId) return;
      const targetSocket = roomManager.getSocketId(meta.roomId, payload.targetId);
      if (!targetSocket) return;
      io.to(targetSocket).emit('voice:signal', meta.playerId, payload.signal);
    });

    socket.on('voice:speaking', (payload: VoiceSpeakingPayload) => {
      const meta = socketMeta.get(socket);
      if (!meta?.roomId || !meta.playerId) return;
      if (payload.playerId !== meta.playerId) return;
      socket.to(`room:${meta.roomId}`).emit('voice:speaking', payload);
    });

    // ── Spectate ────────────────────────────────────────────────────────────
    socket.on('spectate:room', (roomId) => {
      const engine = roomManager.getEngine(roomId);
      if (!engine) return;
      const internal = engine.getState();
      if (!internal.settings.allowSpectators && internal.phase !== 'lobby') {
        socket.emit('error', 'Spectators not allowed in this room');
        return;
      }
      socket.join(`room:${roomId}`);
      socket.emit('state:full', engine.getSpectatorPublicState());
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const meta = socketMeta.get(socket);
      if (meta?.roomId && meta?.playerId) {
        removeVoiceParticipant(meta.roomId, meta.playerId, io);
        handleDisconnect(meta.roomId, meta.playerId, socket, io, roomManager);
      }
    });
  });
}

// ─── Emit roles ONCE to each player ──────────────────────────────────────────

function emitPrivateRoles(
  roomId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  const engine = roomManager.getEngine(roomId);
  if (!engine) return;
  const state = engine.getState();

  state.players.forEach((player) => {
    const role = engine.getRole(player.id);
    const socketId = roomManager.getSocketId(roomId, player.id);
    if (role && socketId) {
      // Snakes get the correct answer for the first question (sent with role)
      io.to(socketId).emit('player:role', role);
    }
  });

  emitSnakePeers(roomId, io, roomManager);
}

function emitSnakePeers(
  roomId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  const engine = roomManager.getEngine(roomId);
  if (!engine) return;
  const state = engine.getState();
  const aliveSnakes = state.players.filter(
    (p) => p.isAlive && !p.isSpectator && engine.getRole(p.id)?.type === 'snake'
  );
  aliveSnakes.forEach((snake) => {
    const socketId = roomManager.getSocketId(roomId, snake.id);
    if (!socketId) return;
    const peers = aliveSnakes.filter((p) => p.id !== snake.id).map((p) => p.id);
    io.to(socketId).emit('player:snake_peers', peers);
  });
}

function removeVoiceParticipant(
  roomId: string,
  playerId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>
): void {
  const set = voiceParticipants.get(roomId);
  if (!set) return;
  set.delete(playerId);
  if (set.size === 0) voiceParticipants.delete(roomId);
  io.to(`room:${roomId}`).emit('voice:peers', [...(set ?? [])]);
}

// ─── Phase Transitions ────────────────────────────────────────────────────────

async function handlePhaseTransition(
  roomId: string,
  endedPhase: GamePhase,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): Promise<void> {
  const engine = roomManager.getEngine(roomId);
  if (!engine) return;
  const state = engine.getState();
  if (state.isPaused) return;

  switch (endedPhase) {
    case 'dealing': {
      await engine.transitionToQuestion();
      // Tell each snake the correct answer privately
      const newState = engine.getState();
      if (newState.currentQuestion) {
        newState.players.forEach((player) => {
          const role = engine.getRole(player.id);
          if (role?.type === 'snake') {
            const socketId = roomManager.getSocketId(roomId, player.id);
            if (socketId) {
              io.to(socketId).emit('quiz:question',
                // omit correctIndex in public event
                {
                  id: newState.currentQuestion!.id,
                  text: newState.currentQuestion!.text,
                  options: newState.currentQuestion!.options,
                },
                newState.currentQuestion!.correctIndex  // snake gets the answer
              );
            }
          }
        });
      }
      break;
    }

    case 'question': {
      engine.transitionToDiscussion();
      startBotDiscussion(roomId, io, roomManager);
      break;
    }

    case 'discussion': {
      engine.transitionToVoting();
      clearRoomBotTimers(roomId);
      void scheduleBotQuizAnswers(roomId, io, roomManager);
      break;
    }

    case 'voting': {
      const before = engine.getState();
      if (before.phase === 'voting') {
        engine.transitionToAnswerReveal();
      }
      const revealState = engine.getState();
      if (revealState.phase === 'answer_reveal' && revealState.currentQuestion) {
        io.to(`room:${roomId}`).emit('quiz:reveal',
          stripAnswerRoles(revealState.answersRevealed),
          revealState.currentQuestion.correctIndex,
          revealState.roundScores[revealState.round] ?? []
        );
      }
      break;
    }

    case 'answer_reveal': {
      engine.transitionToScores();
      break;
    }

    case 'vote_reveal': {
      engine.resolveVotes();
      const afterVotes = engine.getState();
      const lastRound = afterVotes.roundHistory[afterVotes.roundHistory.length - 1];
      if (lastRound) io.to(`room:${roomId}`).emit('round:result', lastRound);
      emitSnakePeers(roomId, io, roomManager);
      break;
    }

    case 'elimination': {
      const winner = engine.evaluateWin();
      if (winner) {
        engine.endGame(winner);
        const finalState = engine.getState();
        io.to(`room:${roomId}`).emit('game:ended', winner, finalState.players, finalState.winnerPlayerIds ?? []);
        leaderboard.recordGame({
          roomId,
          players: finalState.players,
          winner,
          winnerPlayerIds: finalState.winnerPlayerIds,
        });
        roomManager.scheduleRoomClose(roomId);
      } else {
        engine.transitionToScores();
      }
      break;
    }

    case 'scores': {
      const scoresState = engine.getState();
      // Check if we've played all rounds
      if (scoresState.round >= scoresState.totalRounds) {
        const winnerPlayerIds = engine.getHighestScorers();
        engine.endGame(null, winnerPlayerIds);
        const finalState = engine.getState();
        io.to(`room:${roomId}`).emit('game:ended', null, finalState.players, winnerPlayerIds);
        leaderboard.recordGame({
          roomId,
          players: finalState.players,
          winner: null,
          winnerPlayerIds,
        });
        roomManager.scheduleRoomClose(roomId);
      } else {
        engine.nextRound();
        emitPrivateRoles(roomId, io, roomManager);
        await engine.transitionToQuestion();
        // Notify snakes of new correct answer
        const nextState = engine.getState();
        if (nextState.currentQuestion) {
          nextState.players.forEach((player) => {
            const role = engine.getRole(player.id);
            if (role?.type === 'snake' && player.isAlive) {
              const socketId = roomManager.getSocketId(roomId, player.id);
              if (socketId) {
                io.to(socketId).emit('quiz:question',
                  {
                    id: nextState.currentQuestion!.id,
                    text: nextState.currentQuestion!.text,
                    options: nextState.currentQuestion!.options,
                  },
                  nextState.currentQuestion!.correctIndex
                );
              }
            }
          });
        }
      }
      break;
    }

    default: break;
  }

  const engineAfter = roomManager.getEngine(roomId);
  if (!engineAfter) return;
  const updatedState = engineAfter.getPublicState();
  io.to(`room:${roomId}`).emit('state:full', updatedState);
  io.to(`room:${roomId}`).emit('phase:changed', updatedState.phase, updatedState.phaseEndsAt);
}

// ─── Bot Scheduling ───────────────────────────────────────────────────────────

async function scheduleBotVotes(
  roomId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): Promise<void> {
  const engine = roomManager.getEngine(roomId);
  const botEngine = roomManager.getBotEngine(roomId);
  if (!engine || !botEngine) return;

  clearRoomBotTimers(roomId);
  const state = engine.getState();
  if (state.isPaused) return;
  const bots = state.players.filter((p) => p.isBot && p.isAlive && !p.isSpectator);

  for (const bot of bots) {
    const role = engine.getRole(bot.id);
    if (!role) continue;

    const delay = 2000 + Math.random() * 12000;
    scheduleRoomBotTimeout(roomId, () => {
      void (async () => {
        const current = engine.getState();
        if (current.isPaused || current.phase !== 'voting') return;

        const snakeIds = Array.from(engine.getAllRoles().entries())
          .filter(([, r]) => r.type === 'snake')
          .map(([id]) => id);

        const targetId = await botEngine.decideVote(bot, role.type, current, snakeIds);
        if (!targetId) return;

        const result = engine.castVote(bot.id, targetId);
        if (result.success) {
          emitVoteTally(roomId, io, roomManager);
        }
      })();
    }, delay);
  }
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

  // Ignore stale socket after refresh: a newer socket already registered for this player.
  const activeSocketId = roomManager.getSocketId(roomId, playerId);
  if (activeSocketId && activeSocketId !== _socket.id) return;

  const player = engine.getState().players.find((p) => p.id === playerId);
  const socketMetaEntry = socketMeta.get(_socket);
  if (player && socketMetaEntry?.identityHash) {
    identityStore.recordDisconnect(
      roomId,
      playerId,
      player.username,
      socketMetaEntry.displayName ?? player.username,
      socketMetaEntry.identityHash,
      engine.getState().phase
    );
  }

  engine.removePlayer(playerId);
  roomManager.unregisterSocket(roomId, playerId);

  const state = engine.getState();
  const connectedPlayers = state.players.filter((p) => p.isConnected && !p.isSpectator);

  if (connectedPlayers.length === 0) {
    roomManager.scheduleRoomClose(roomId);
  } else {
    roomManager.cancelScheduledClose(roomId);
    io.to(`room:${roomId}`).emit('player:left', playerId);
    emitPublicState(roomId, io, roomManager);
  }
  broadcastAdminState(io, roomManager);
}

function broadcastAdminState(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  io.to('admin').emit('admin:state', roomManager.getAdminState());
  io.to('admin').emit('room:list', roomManager.getRoomList());
}
