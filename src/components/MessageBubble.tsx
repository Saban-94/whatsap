import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Download, 
  Eye, 
  Maximize2, 
  Smile, 
  CheckCheck,
  Pause,
  Play,
  Mic
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';
import { cn } from '../lib/utils';
import { DeepDiveCard } from './DeepDiveCard';

const AudioPlayer = ({ url, duration }: { url?: string, duration?: number }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (playing) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setPlaying(!playing);
  };

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 py-2 px-1 min-w-[200px]">
      <audio 
        ref={audioRef} 
        src={url} 
        onEnded={() => setPlaying(false)} 
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      />
      <button onClick={togglePlay} className="text-[#54656f] hover:text-[#00a884] transition-colors">
        {playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
      </button>
      <div className="flex-1 h-1 bg-gray-200 rounded-full relative">
        <div 
          className="absolute inset-y-0 left-0 bg-[#00a884] rounded-full" 
          style={{ width: `${(currentTime / (duration || audioRef.current?.duration || 1)) * 100}%` }}
        />
      </div>
      <span className="text-[11px] text-gray-500 font-mono">
        {formatTime(currentTime || duration || 0)}
      </span>
      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
        <Mic className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  onReact: (messageId: string, emoji: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, onReact }) => {
  const [showReactions, setShowReactions] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const isPDF = message.fileName?.toLowerCase().endsWith('.pdf');
  const isImage = message.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
  const hasContent = !!message.fileContent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex w-full mb-4 group",
        isMe ? "justify-end" : "justify-start"
      )}
      onMouseLeave={() => setShowReactions(false)}
    >
      <div className={cn("relative flex items-end gap-1", isMe ? "flex-row-reverse" : "flex-row")}>
        <div
          className={cn(
            "max-w-[85%] px-2 py-1.5 rounded-lg shadow-sm relative",
            isMe ? "bg-[#d9fdd3] rounded-tr-none" : "bg-white rounded-tl-none"
          )}
        >
          {message.type === 'file' ? (
            <div className="flex flex-col gap-2">
              <a 
                href={message.fileUrl} 
                download={message.fileName} 
                className="flex items-center gap-3 p-3 bg-black/5 rounded-md border border-gray-100 hover:bg-black/10 transition-colors cursor-pointer"
              >
                <div className="bg-[#00a884] p-3 rounded text-white shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0 mx-3">
                  <p className="text-sm font-medium truncate">{message.fileName || 'קובץ'}</p>
                  <p className="text-[10px] text-gray-500 uppercase">
                    {message.fileName?.split('.').pop()?.toUpperCase() || 'FILE'}
                  </p>
                </div>
                <Download className="w-5 h-5 text-[#8696a0]" />
              </a>

              {(isPDF || isImage || hasContent) && (
                <button 
                  onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                  className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-[#00a884] font-medium border border-[#00a884]/20 rounded bg-[#00a884]/5 hover:bg-[#00a884]/10 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {isPreviewOpen ? 'סגור תצוגה' : 'פתח תצוגה מהירה'}
                </button>
              )}

              <AnimatePresence>
                {isPreviewOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 rounded border border-gray-200 bg-gray-50 overflow-hidden max-h-[300px] flex flex-col">
                      {isImage ? (
                        <img src={message.fileUrl} alt="preview" className="w-full object-contain" referrerPolicy="no-referrer" />
                      ) : isPDF ? (
                        <iframe src={message.fileUrl} className="w-full h-[250px] border-none" title="PDF Preview" />
                      ) : hasContent ? (
                        <div className="p-3 text-xs font-mono whitespace-pre-wrap break-words overflow-y-auto custom-scrollbar bg-white text-gray-700">
                          {message.fileContent}
                        </div>
                      ) : null}
                      <div className="p-2 flex justify-between items-center bg-gray-100 border-t border-gray-200 shrink-0">
                        <span className="text-[10px] text-gray-500">{message.fileName}</span>
                        <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#00a884] hover:underline flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" /> מסך מלא
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : message.type === 'audio' ? (
             <AudioPlayer url={message.fileUrl} duration={message.duration} />
          ) : (
            <div className="text-[14.2px] text-[#111b21] leading-normal markdown-body prose-compact min-w-[50px]">
              {(() => {
                try {
                  const data = JSON.parse(message.text);
                  if (data && (data.customerName || data.customer) && (data.items || data.destination)) {
                    return <DeepDiveCard order={data} />;
                  }
                } catch (e) {
                  // Not valid JSON
                }
                
                return (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.text}
                  </ReactMarkdown>
                );
              })()}
            </div>
          )}
          
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[11px] text-gray-500">
              {message.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '...'}
            </span>
            {isMe && (
              message.status === 'read' ? (
                <CheckCheck className="w-[16px] h-[16px] text-[#53bdeb]" />
              ) : (
                <CheckCheck className="w-[16px] h-[16px] text-[#8696a0]" />
              )
            )}
          </div>

          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className={cn(
              "absolute -bottom-3 flex gap-1 bg-white rounded-full px-1.5 py-0.5 shadow-md border border-gray-100 z-[1]",
              isMe ? "left-0" : "right-0"
            )}>
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <span key={emoji} className="text-[11px] flex items-center gap-0.5">
                  {emoji} <span className="text-gray-500">{(users as string[]).length > 1 ? (users as string[]).length : ''}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity relative self-center">
          <button 
            onClick={() => setShowReactions(!showReactions)}
            className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
          >
            <Smile className="w-5 h-5" />
          </button>
          
          <AnimatePresence>
            {showReactions && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                className={cn(
                  "absolute bottom-full mb-2 bg-white rounded-full shadow-xl border border-gray-100 p-1 flex gap-2 z-50",
                  isMe ? "right-0" : "left-0"
                )}
              >
                {emojis.map(emoji => (
                  <button 
                    key={emoji}
                    onClick={() => {
                      onReact(message.id!, emoji);
                      setShowReactions(false);
                    }}
                    className="hover:scale-125 transition-transform p-1 text-xl"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
