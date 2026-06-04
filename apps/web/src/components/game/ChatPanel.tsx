import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import type { ChatMessage, TypingIndicator } from '@snakesss/shared-types';

interface ChatPanelProps {
  messages: ChatMessage[];
  typingIndicators: TypingIndicator[];
  myPlayerId: string | null;
  canChat: boolean;
  /** When false, skip auto-scroll (avoids shifting the swipe carousel off-screen). */
  isActive?: boolean;
  onSend: (content: string, type?: 'chat' | 'accusation' | 'defense') => void;
  onTyping: (isTyping: boolean) => void;
}

const REACTIONS = ['👍', '😂', '😮', '❤️', '🐍', '🤔'];

export function ChatPanel({
  messages,
  typingIndicators,
  myPlayerId,
  canChat,
  isActive = true,
  onSend,
  onTyping,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [messageType, setMessageType] = useState<'chat' | 'accusation' | 'defense'>('chat');
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, isActive]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    onTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => onTyping(false), 1500);
  }, [onTyping]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !canChat) return;
    onSend(trimmed, messageType);
    setInput('');
    onTyping(false);
    clearTimeout(typingTimerRef.current);
  }, [input, canChat, onSend, messageType, onTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const otherTyping = typingIndicators.filter((t) => t.playerId !== myPlayerId && t.isTyping);

  return (
    <div data-testid="chat-panel" className="flex flex-col h-full w-full min-w-0">
      {/* Messages */}
      <div
        ref={messagesScrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none touch-pan-y overscroll-y-contain space-y-2 p-3 min-h-0 w-full"
      >
        {messages.length === 0 && (
          <div
            data-testid="chat-empty-state"
            className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center"
          >
            <span className="text-3xl opacity-40">💬</span>
            <p className="text-sm text-white/55">Debate is open — be the first to speak</p>
            {canChat && (
              <p className="text-xs text-white/35">Type a message below</p>
            )}
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={clsx(
                'flex gap-2 w-full min-w-0',
                msg.playerId === myPlayerId ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div className="text-xl flex-shrink-0 mt-1">{msg.playerAvatar}</div>
              <div
                className={clsx(
                  'max-w-[85%] min-w-0 flex flex-col gap-0.5',
                  msg.playerId === myPlayerId ? 'items-end' : 'items-start'
                )}
              >
                {msg.type === 'system' ? (
                  <div className="text-xs text-center text-white/40 italic w-full">
                    {msg.content}
                  </div>
                ) : (
                  <>
                    <span className="text-[10px] text-white/40 px-1">
                      {msg.playerName}
                      {msg.type === 'accusation' && ' 🔴 accused'}
                      {msg.type === 'defense' && ' 🛡️ defended'}
                    </span>
                    <div
                      className={clsx(
                        'px-3 py-2 rounded-2xl text-sm',
                        msg.playerId === myPlayerId
                          ? 'bg-gradient-to-br from-green-500/30 to-teal-500/20 border border-green-500/20'
                          : msg.type === 'accusation'
                          ? 'bg-red-500/20 border border-red-500/20'
                          : msg.type === 'defense'
                          ? 'bg-blue-500/20 border border-blue-500/20'
                          : 'glass'
                      )}
                    >
                      <p className="text-white/90 leading-relaxed">{msg.content}</p>
                    </div>
                    <span className="text-[9px] text-white/30 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicators */}
        <AnimatePresence>
          {otherTyping.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex items-center gap-2 px-3"
            >
              <span className="text-xs text-white/40">
                {otherTyping.map((t) => t.playerName).join(', ')} typing
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Input area */}
      {canChat && (
        <div className="p-3 border-t border-white/5">
          {/* Message type selector */}
          <div className="flex gap-1.5 mb-2">
            {(['chat', 'accusation', 'defense'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setMessageType(type)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  messageType === type
                    ? type === 'chat' ? 'bg-white/20 text-white' :
                      type === 'accusation' ? 'bg-red-500/30 text-red-300' :
                      'bg-blue-500/30 text-blue-300'
                    : 'text-white/40 hover:text-white/60'
                )}
              >
                {type === 'chat' ? '💬 Chat' : type === 'accusation' ? '🔴 Accuse' : '🛡️ Defend'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              ref={inputRef}
              data-testid="chat-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              maxLength={280}
              placeholder="Say something..."
              className={clsx(
                'flex-1 glass rounded-xl px-3 py-2.5 text-base text-white',
                'placeholder:text-white/30 outline-none',
                'focus:border-white/30 transition-all'
              )}
            />
            <motion.button
              data-testid="chat-send"
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={!input.trim()}
              className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                'btn-primary disabled:opacity-40 disabled:cursor-not-allowed',
                'flex-shrink-0'
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </motion.button>
          </div>
        </div>
      )}

      {!canChat && (
        <div className="p-3 border-t border-white/5 text-center text-xs text-white/40">
          Chat disabled outside discussion phase
        </div>
      )}
    </div>
  );
}
