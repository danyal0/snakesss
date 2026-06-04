import { Server } from 'socket.io';
import type { AnswerIndex, ClientToServerEvents, ServerToClientEvents } from '@snakesss/shared-types';
import { RoomManager } from './RoomManager';
import { clearRoomBotTimers, scheduleRoomBotTimeout } from './botTimers';

type Io = Server<ClientToServerEvents, ServerToClientEvents>;

/** Begin multi-turn bot discussion for the current round. */
export function startBotDiscussion(
  roomId: string,
  io: Io,
  roomManager: RoomManager
): void {
  const engine = roomManager.getEngine(roomId);
  const botEngine = roomManager.getBotEngine(roomId);
  if (!engine || !botEngine) return;
  clearRoomBotTimers(roomId);


  const state = engine.getState();
  const question = state.currentQuestion;
  if (!question || state.phase !== 'discussion') return;

  const bots = state.players.filter((p) => p.isBot && p.isAlive && !p.isSpectator);

  for (const bot of bots) {
    const role = engine.getRole(bot.id);
    if (!role) continue;
    botEngine.initDiscussionRound(bot.id, role.type, question, question.correctIndex);
  }

  for (const bot of bots) {
    const stagger = 1500 + Math.random() * 4000;
    scheduleRoomBotTimeout(roomId, () => {
      void scheduleBotDiscussionTurn(roomId, bot.id, io, roomManager);
    }, stagger);
  }
}

/** After any chat activity, let bots react with staggered replies. */
export function notifyDiscussionChat(
  roomId: string,
  io: Io,
  roomManager: RoomManager,
  triggerPlayerId?: string
): void {
  const engine = roomManager.getEngine(roomId);
  if (!engine) return;
  const state = engine.getState();
  if (state.phase !== 'discussion' || state.isPaused) return;

  const bots = state.players.filter(
    (p) =>
      p.isBot &&
      p.isAlive &&
      !p.isSpectator &&
      p.id !== triggerPlayerId
  );

  for (const bot of bots) {
    const delay = 1200 + Math.random() * 3500;
    scheduleRoomBotTimeout(roomId, () => {
      void scheduleBotDiscussionTurn(roomId, bot.id, io, roomManager);
    }, delay);
  }
}

async function scheduleBotDiscussionTurn(
  roomId: string,
  botId: string,
  io: Io,
  roomManager: RoomManager
): Promise<void> {
  const engine = roomManager.getEngine(roomId);
  const botEngine = roomManager.getBotEngine(roomId);
  if (!engine || !botEngine) return;

  const state = engine.getState();
  if (state.isPaused || state.phase !== 'discussion') return;

  const bot = state.players.find((p) => p.id === botId);
  const role = bot ? engine.getRole(bot.id) : undefined;
  const question = state.currentQuestion;
  if (!bot || !role || !question) return;

  if (!botEngine.shouldContinueDiscussion(bot, role.type, state, state.phaseEndsAt)) {
    botEngine.evaluateAnswerLock(
      bot,
      role.type,
      state,
      question,
      question.correctIndex,
      state.phaseEndsAt
    );
    return;
  }

  const accusedBy = state.chat
    .filter(
      (m) =>
        m.round === state.round &&
        m.content.toLowerCase().includes(bot.username.toLowerCase())
    )
    .map((m) => m.playerName);

  const decision = await botEngine.decideMessage(
    bot,
    role.type,
    state,
    accusedBy,
    question,
    question.correctIndex
  );

  if (!decision) {
    botEngine.evaluateAnswerLock(
      bot,
      role.type,
      engine.getState(),
      question,
      question.correctIndex,
      state.phaseEndsAt
    );
    return;
  }

  const check = engine.getState();
  if (check.isPaused || check.phase !== 'discussion') return;

  io.to(`room:${roomId}`).emit('chat:typing', {
    playerId: bot.id,
    playerName: bot.username,
    isTyping: true,
  });

  scheduleRoomBotTimeout(roomId, () => {
    const afterTyping = engine.getState();
    if (afterTyping.isPaused || afterTyping.phase !== 'discussion') {
      io.to(`room:${roomId}`).emit('chat:typing', {
        playerId: bot.id,
        playerName: bot.username,
        isTyping: false,
      });
      return;
    }

    const msg = engine.addMessage(bot.id, decision.message, 'chat');
    io.to(`room:${roomId}`).emit('chat:typing', {
      playerId: bot.id,
      playerName: bot.username,
      isTyping: false,
    });

    if (msg) {
      io.to(`room:${roomId}`).emit('chat:message', msg);
      notifyDiscussionChat(roomId, io, roomManager, bot.id);
    }

    const followDelay = 2500 + Math.random() * 5000;
    scheduleRoomBotTimeout(roomId, () => {
      void scheduleBotDiscussionTurn(roomId, bot.id, io, roomManager);
    }, followDelay);
  }, decision.delay);
}

/** Lock any remaining bot answers before voting. */
export function finalizeBotDiscussionAnswers(
  roomId: string,
  roomManager: RoomManager
): void {
  const engine = roomManager.getEngine(roomId);
  const botEngine = roomManager.getBotEngine(roomId);
  if (!engine || !botEngine) return;

  const state = engine.getState();
  const question = state.currentQuestion;
  if (!question) return;

  const bots = state.players.filter((p) => p.isBot && p.isAlive && !p.isSpectator);
  for (const bot of bots) {
    const role = engine.getRole(bot.id);
    if (!role) continue;
    botEngine.evaluateAnswerLock(
      bot,
      role.type,
      state,
      question,
      question.correctIndex,
      state.phaseEndsAt
    );
  }
}

export async function scheduleBotQuizAnswers(
  roomId: string,
  io: Io,
  roomManager: RoomManager
): Promise<void> {
  const engine = roomManager.getEngine(roomId);
  const botEngine = roomManager.getBotEngine(roomId);
  if (!engine || !botEngine) return;

  finalizeBotDiscussionAnswers(roomId, roomManager);

  const state = engine.getState();
  if (state.isPaused) return;
  const bots = state.players.filter((p) => p.isBot && p.isAlive && !p.isSpectator);
  const question = state.currentQuestion;
  if (!question) return;

  for (const bot of bots) {
    const role = engine.getRole(bot.id);
    if (!role) continue;

    const delay = 1500 + Math.random() * Math.min(state.settings.voteTimer * 800, 12000);

    scheduleRoomBotTimeout(roomId, () => {
      const currentState = engine.getState();
      if (currentState.isPaused || currentState.phase !== 'voting') return;

      const choice = botEngine.decideAnswer(
        bot,
        role.type,
        question,
        question.correctIndex as AnswerIndex,
        currentState
      );

      const result = engine.submitAnswer(bot.id, choice);
      if (result.success) {
        const total = engine
          .getState()
          .players.filter((p) => p.isAlive && !p.isSpectator).length;
        io.to(`room:${roomId}`).emit('quiz:answer_update', engine.getAnswerMap().size, total);
      }
    }, delay);
  }
}
