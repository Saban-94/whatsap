import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageBubble } from './MessageBubble';
import { Message } from '../types';

interface NoaChatProps {
  messages: Message[];
  isNoaTyping: boolean;
  user: any;
  handleReact: (messageId: string, emoji: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const NoaChat: React.FC<NoaChatProps> = ({ 
  messages, 
  isNoaTyping, 
  user, 
  handleReact, 
  messagesEndRef 
}) => {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10 space-y-2 custom-scrollbar pb-10">
      <div className="flex justify-center mb-6">
        <span className="bg-[#e1f3fb] text-[#54656f] text-[11px] px-3 py-1 rounded-md uppercase font-medium">
          today
        </span>
      </div>

      <div className="flex justify-center mb-4">
        <div className="bg-[#fff9c6] text-[#111b21] text-[11px] px-4 py-2 rounded-lg shadow-sm text-center max-w-md">
          🔒 הודעות ואתגרים מוצפנים מקצה לקצה. לאף אחד מחוץ לצ'אט זה, אפילו לא לסבאן, אין אפשרות לקרוא אותם.
        </div>
      </div>

      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} isMe={m.senderId === user.uid} onReact={handleReact} />
      ))}
      
      {isNoaTyping && (
        <div className="flex justify-start mb-4">
          <div className="italic text-sm text-[#00a884] font-medium mr-2">
            נועה מקלידה...
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};
