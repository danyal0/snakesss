import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinRoomPayload,
  CreateRoomPayload,
  GamePhase,
  AnswerIndex,
  getOptimalRoleDistribution,
} from '@snakesss/shared-types';
import { buildVoteTally, stripAnswerRoles } from '@snakesss/game-engine';
import { RoomManager } from './RoomManager';
import { leaderboard } from './LeaderboardStore';
import { clearRoomBotTimers, scheduleRoomBotTimeout } from './botTimers';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type AdminSocket = AppSocket & { isAdmin?: boolean };

interface SocketMeta {
  playerId?: string;
  roomId?: string;
}

const socketMeta = new WeakMap<AppSocket, SocketMeta>();

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
      const { username, avatar, settings } = _payload;
      const playerId = socket.id;

      const roomId = roomManager.createRoom(playerId, username, avatar, settings);
      const meta = socketMeta.get(socket)!;
      meta.playerId = playerId;
      meta.roomId = roomId;

      roomManager.registerSocket(roomId, playerId, socket.id);
      socket.join(`room:${roomId}`);
      cb(roomId);

      const engineOnCreate = roomManager.getEngine(roomId);
      if (engineOnCreate) socket.emit('state:full', engineOnCreate.getPublicState());

      broadcastAdminState(io, roomManager);
    });

    // ── Room: Join ──────────────────────────────────────────────────────────
    socket.on('room:join', (_payload: JoinRoomPayload, cb) => {
      const { roomId, username, avatar, asSpectator } = _payload;

      if (roomManager.isBanned(roomId, undefined, username)) {
        cb({ error: 'You are banned from this room' });
        return;
      }

      const engine = roomManager.getEngine(roomId);
      if (!engine) { cb({ error: 'Room not found' }); return; }

      // ── Reconnect: try to restore a disconnected player by username ──────
      // When a player refreshes (new socket ID), match them by username so they
      // keep their role, manager status, and score.
      let effectivePlayerId = socket.id;
      const rejoinPlayerId = _payload.playerId;

      if (rejoinPlayerId) {
        const slot = engine.getState().players.find(
          (p) => p.id === rejoinPlayerId && !p.isSpectator
        );
        if (slot?.isConnected) {
          cb({ error: 'Player already connected in this room' });
          return;
        }
        if (slot && !slot.isConnected) {
          effectivePlayerId = rejoinPlayerId;
          engine.reconnectPlayer(rejoinPlayerId, socket.id);
        }
      }

      if (effectivePlayerId === socket.id) {
        const existingPlayer = engine.getState().players.find(
          (p) =>
            p.username.toLowerCase().trim() === username.toLowerCase().trim() &&
            !p.isSpectator &&
            !p.isConnected
        );

        if (existingPlayer) {
          effectivePlayerId = existingPlayer.id;
          engine.reconnectPlayer(existingPlayer.id, socket.id);
        } else {
          const result = engine.addPlayer(socket.id, username, avatar, asSpectator);
          if (!result.success) { cb({ error: result.error ?? 'Failed to join' }); return; }
        }
      }

      if (roomManager.isBanned(roomId, effectivePlayerId, username)) {
        cb({ error: 'You are banned from this room' });
        return;
      }

      const meta = socketMeta.get(socket)!;
      meta.playerId = effectivePlayerId;
      meta.roomId = roomId;

      roomManager.registerSocket(roomId, effectivePlayerId, socket.id);
      socket.join(`room:${roomId}`);

      const state = engine.getPublicState();
      cb(state);
      emitPublicState(roomId, io, roomManager);

      // Re-send private role to the (re)joining player
      const role = engine.getRole(effectivePlayerId);
      if (role && state.phase !== 'lobby') {
        socket.emit('player:role', role);
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

      // Auto-fix role distribution to be valid before starting
      const currentState = engine.getState();
      const activePlayers = currentState.players.filter((p) => !p.isSpectator && p.isConnected);
      if (activePlayers.length >= 3) {
        // Ensure role distribution is sane (won't exceed player count)
        const optimal = getOptimalRoleDistribution(activePlayers.length);
        engine.updateSettings({
          roleDistribution: optimal,
          advancedRoles: currentState.settings.advancedRoles,
        });
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

      const result = engine.submitAnswer(meta.playerId, payload.answerIndex as AnswerIndex);
      if (!result.success) return;

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
      if (message) io.to(`room:${meta.roomId}`).emit('chat:message', message);
      else socket.emit('error', 'Message rate limit — slow down');
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
      void scheduleBotAnswers(roomId, io, roomManager);
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
      const currentState = engine.getState();
      const alivePlayers = currentState.players.filter((p) => p.isAlive && !p.isSpectator);
      const answerMap = engine.getAnswerMap();
      for (const player of alivePlayers) {
        if (!answerMap.has(player.id) && player.isBot) {
          const randomAnswer = Math.floor(Math.random() * 3) as AnswerIndex;
          engine.submitAnswer(player.id, randomAnswer);
        }
      }
      // submitAnswer triggers transitionToAnswerReveal when all answered
      // If not triggered yet:
      const afterState = engine.getState();
      if (afterState.phase === 'question') engine.transitionToAnswerReveal();
      break;
    }

    case 'answer_reveal': {
      // Broadcast full reveal to all clients
      const revealState = engine.getState();
      if (revealState.currentQuestion) {
        io.to(`room:${roomId}`).emit('quiz:reveal',
          stripAnswerRoles(revealState.answersRevealed),
          revealState.currentQuestion.correctIndex,
          revealState.roundScores[revealState.round] ?? []
        );
      }
      engine.transitionToDiscussion();
      void scheduleBotChat(roomId, io, roomManager);
      break;
    }

    case 'discussion': {
      engine.transitionToVoting();
      void scheduleBotVotes(roomId, io, roomManager);
      break;
    }

    case 'voting': {
      engine.transitionToVoteReveal();
      break;
    }

    case 'vote_reveal': {
      engine.resolveVotes();
      const afterVotes = engine.getState();
      const lastRound = afterVotes.roundHistory[afterVotes.roundHistory.length - 1];
      if (lastRound) io.to(`room:${roomId}`).emit('round:result', lastRound);
      break;
    }

    case 'elimination': {
      const winner = engine.evaluateWin();
      if (winner) {
        engine.endGame(winner);
        const finalState = engine.getState();
        io.to(`room:${roomId}`).emit('game:ended', winner, finalState.players);
        // Record to persistent leaderboard immediately on game end
        leaderboard.recordGame({ players: finalState.players, winner });
      } else {
        engine.transitionToScores();
      }
      break;
    }

    case 'scores': {
      const scoresState = engine.getState();
      // Check if we've played all rounds
      if (scoresState.round >= scoresState.totalRounds) {
        const winner = engine.evaluateWin() ?? 'humans';
        engine.endGame(winner);
        const finalState = engine.getState();
        io.to(`room:${roomId}`).emit('game:ended', winner, finalState.players);
        // Record to persistent leaderboard
        leaderboard.recordGame({ players: finalState.players, winner });
      } else {
        engine.nextRound();
        await engine.transitionToQuestion();
        void scheduleBotAnswers(roomId, io, roomManager);
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

async function scheduleBotAnswers(
  roomId: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): Promise<void> {
  const engine = roomManager.getEngine(roomId);
  if (!engine) return;
  clearRoomBotTimers(roomId);
  const state = engine.getState();
  if (state.isPaused) return;
  const bots = state.players.filter((p) => p.isBot && p.isAlive && !p.isSpectator);
  const question = state.currentQuestion;
  if (!question) return;

  for (const bot of bots) {
    const role = engine.getRole(bot.id);
    const delay = 1500 + Math.random() * Math.min(state.settings.questionTimer * 600, 15000);

    scheduleRoomBotTimeout(roomId, () => {
      const currentState = engine.getState();
      if (currentState.isPaused || currentState.phase !== 'question') return;

      let answer: AnswerIndex;
      if (role?.type === 'snake') {
        const wrongAnswers = ([0, 1, 2] as AnswerIndex[]).filter((i) => i !== question.correctIndex);
        answer = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)]!;
      } else {
        const isCorrect = Math.random() < 0.65;
        if (isCorrect) {
          answer = question.correctIndex;
        } else {
          const wrongAnswers = ([0, 1, 2] as AnswerIndex[]).filter((i) => i !== question.correctIndex);
          answer = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)]!;
        }
      }

      const result = engine.submitAnswer(bot.id, answer);
      if (result.success) {
        const total = engine.getState().players.filter((p) => p.isAlive && !p.isSpectator).length;
        io.to(`room:${roomId}`).emit('quiz:answer_update', engine.getAnswerMap().size, total);
      }
    }, delay);
  }
}


async function scheduleBotChat(
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

    const delay = 2000 + Math.random() * 10000;
    scheduleRoomBotTimeout(roomId, () => {
      void (async () => {
        const current = engine.getState();
        if (current.isPaused || current.phase !== 'discussion') return;

        const accusedBy = current.chat
          .filter((m) => m.round === current.round && m.content.toLowerCase().includes(bot.username.toLowerCase()))
          .map((m) => m.playerName);

        const decision = await botEngine.decideMessage(bot, role.type, current, accusedBy);
        if (!decision) return;

        const check = engine.getState();
        if (check.isPaused || check.phase !== 'discussion') return;

        io.to(`room:${roomId}`).emit('chat:typing', {
          playerId: bot.id,
          playerName: bot.username,
          isTyping: true,
        });

        scheduleRoomBotTimeout(roomId, () => {
          const msg = engine.addMessage(bot.id, decision.message, 'chat');
          if (msg) {
            io.to(`room:${roomId}`).emit('chat:message', msg);
            io.to(`room:${roomId}`).emit('chat:typing', {
              playerId: bot.id,
              playerName: bot.username,
              isTyping: false,
            });
          }
        }, decision.delay);
      })();
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

  engine.removePlayer(playerId);
  roomManager.unregisterSocket(roomId, playerId);

  const state = engine.getState();
  const connectedPlayers = state.players.filter((p) => p.isConnected && !p.isSpectator);

  if (connectedPlayers.length === 0 && state.phase === 'lobby') {
    roomManager.closeRoom(roomId);
  } else {
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
