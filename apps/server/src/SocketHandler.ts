import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  JoinRoomPayload,
  CreateRoomPayload,
  GamePhase,
  AnswerIndex,
} from '@snakesss/shared-types';
import { RoomManager } from './RoomManager';
import { verifyAdminToken } from './auth';
import { leaderboard } from './LeaderboardStore';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

interface SocketMeta {
  playerId?: string;
  roomId?: string;
}

const socketMeta = new WeakMap<AppSocket, SocketMeta>();

export function registerSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomManager: RoomManager
): void {
  // Broadcast state changes — but do NOT emit player:role here (causes repeated role reveals)
  roomManager.onStateChanged((roomId, state) => {
    io.to(`room:${roomId}`).emit('state:full', state);
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

      const state = roomManager.getEngine(roomId)?.getState();
      if (state) socket.emit('state:full', state);

      broadcastAdminState(io, roomManager);
    });

    // ── Room: Join ──────────────────────────────────────────────────────────
    socket.on('room:join', (_payload: JoinRoomPayload, cb) => {
      const { roomId, username, avatar, asSpectator } = _payload;
      const playerId = socket.id;

      if (roomManager.isBanned(roomId, playerId)) {
        cb({ error: 'You are banned from this room' });
        return;
      }

      const engine = roomManager.getEngine(roomId);
      if (!engine) { cb({ error: 'Room not found' }); return; }

      const result = engine.addPlayer(playerId, username, avatar, asSpectator);
      if (!result.success) { cb({ error: result.error ?? 'Failed to join' }); return; }

      const meta = socketMeta.get(socket)!;
      meta.playerId = playerId;
      meta.roomId = roomId;

      roomManager.registerSocket(roomId, playerId, socket.id);
      socket.join(`room:${roomId}`);

      const state = engine.getState();
      cb(state);
      io.to(`room:${roomId}`).emit('state:full', state);
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

      const result = engine.startGame();
      if (!result.success) { socket.emit('error', result.error ?? 'Could not start game'); return; }

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
      io.to(`room:${meta.roomId}`).emit('state:full', engine.getState());
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
      const answeredCount = Object.keys(state.answers).length;
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
      io.to(`room:${meta.roomId}`).emit('vote:update', engine.getState().votes);
    });

    // ── Admin Action ────────────────────────────────────────────────────────
    socket.on('admin:action', (payload) => {
      const meta = socketMeta.get(socket) ?? {};
      const roomId = (payload.data?.['roomId'] as string) ?? meta.roomId;
      if (!roomId) return;
      const engine = roomManager.getEngine(roomId);
      if (!engine) return;

      switch (payload.action) {
        case 'kick': if (payload.targetId) engine.kickPlayer(payload.targetId); break;
        case 'ban': if (payload.targetId) roomManager.banPlayer(roomId, payload.targetId); break;
        case 'inject_bot': {
          const persona = payload.data?.['persona'] as string ?? 'chaotic_liar';
          roomManager.injectBot(roomId, persona as 'aggressive' | 'silent_strategist' | 'chaotic_liar');
          break;
        }
        case 'pause': engine.pause(); io.to(`room:${roomId}`).emit('state:full', engine.getState()); break;
        case 'resume': engine.resume(); io.to(`room:${roomId}`).emit('state:full', engine.getState()); break;
      }
      broadcastAdminState(io, roomManager);
    });

    // ── Spectate ────────────────────────────────────────────────────────────
    socket.on('spectate:room', (roomId) => {
      socket.join(`room:${roomId}`);
      const engine = roomManager.getEngine(roomId);
      if (engine) socket.emit('state:full', engine.getState());
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
      // Time ran out — fill missing answers with random for bots, skip for humans
      const currentState = engine.getState();
      const alivePlayers = currentState.players.filter((p) => p.isAlive && !p.isSpectator);
      for (const player of alivePlayers) {
        if (!(player.id in currentState.answers)) {
          const randomAnswer = (Math.floor(Math.random() * 3) as AnswerIndex);
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
          revealState.answersRevealed,
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
        // Schedule bot answers
        void scheduleBotAnswers(roomId, io, roomManager);
      }
      break;
    }

    default: break;
  }

  const updatedState = engine.getState();
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
  const state = engine.getState();
  const bots = state.players.filter((p) => p.isBot && p.isAlive && !p.isSpectator);
  const question = state.currentQuestion;
  if (!question) return;

  for (const bot of bots) {
    const role = engine.getRole(bot.id);
    const delay = 1500 + Math.random() * Math.min(state.settings.questionTimer * 600, 15000);

    setTimeout(() => {
      const currentState = engine.getState();
      if (currentState.phase !== 'question') return;

      let answer: AnswerIndex;
      if (role?.type === 'snake') {
        // Snake: pick a WRONG answer (bluffing strategy)
        const wrongAnswers = ([0, 1, 2] as AnswerIndex[]).filter(
          (i) => i !== question.correctIndex
        );
        answer = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)]!;
      } else {
        // Human bot: try to answer correctly but might make mistakes
        const isCorrect = Math.random() < 0.65;
        if (isCorrect) {
          answer = question.correctIndex;
        } else {
          const wrongAnswers = ([0, 1, 2] as AnswerIndex[]).filter(
            (i) => i !== question.correctIndex
          );
          answer = wrongAnswers[Math.floor(Math.random() * wrongAnswers.length)]!;
        }
      }

      const result = engine.submitAnswer(bot.id, answer);
      if (result.success) {
        const updatedState = engine.getState();
        const total = updatedState.players.filter((p) => p.isAlive && !p.isSpectator).length;
        io.to(`room:${roomId}`).emit(
          'quiz:answer_update',
          Object.keys(updatedState.answers).length,
          total
        );
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

  const state = engine.getState();
  const bots = state.players.filter((p) => p.isBot && p.isAlive && !p.isSpectator);

  for (const bot of bots) {
    const role = engine.getRole(bot.id);
    if (!role) continue;

    const delay = 2000 + Math.random() * 10000;
    setTimeout(async () => {
      const current = engine.getState();
      if (current.phase !== 'discussion') return;

      const accusedBy = current.chat
        .filter((m) => m.round === current.round && m.content.toLowerCase().includes(bot.username.toLowerCase()))
        .map((m) => m.playerName);

      const decision = await botEngine.decideMessage(bot, role.type, current, accusedBy);
      if (!decision) return;

      const check = engine.getState();
      if (check.phase !== 'discussion') return;

      io.to(`room:${roomId}`).emit('chat:typing', {
        playerId: bot.id,
        playerName: bot.username,
        isTyping: true,
      });

      setTimeout(() => {
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

    const delay = 2000 + Math.random() * 12000;
    setTimeout(async () => {
      const current = engine.getState();
      if (current.phase !== 'voting') return;

      const snakeIds = Array.from(engine.getAllRoles().entries())
        .filter(([, r]) => r.type === 'snake')
        .map(([id]) => id);

      const targetId = await botEngine.decideVote(bot, role.type, current, snakeIds);
      if (!targetId) return;

      const result = engine.castVote(bot.id, targetId);
      if (result.success) {
        io.to(`room:${roomId}`).emit('vote:update', engine.getState().votes);
      }
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
    io.to(`room:${roomId}`).emit('state:full', state);
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
