import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MoreVertical, 
  MessageSquare, 
  CircleDashed, 
  Filter, 
  Paperclip, 
  Smile, 
  Mic, 
  Send, 
  Check, 
  CheckCheck,
  FileText,
  Download,
  Menu,
  X,
  LogOut,
  User,
  Play,
  Pause,
  Trash2,
  ArrowRight,
  ChevronLeft,
  Settings,
  LayoutGrid,
  Eye,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  getDocs,
  serverTimestamp, 
  doc, 
  setDoc, 
  updateDoc,
  where
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, signIn, signOut } from './lib/firebase';
import { cn } from './lib/utils';
import { ChatMetadata, Message, UserProfile, Order } from './types';
import { ai, NOA_SYSTEM_INSTRUCTION } from './lib/ai';
import { processNoaTurn } from './lib/auraService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Components ---

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

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe, onReact }) => {
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
            <div className="text-[14.2px] text-[#111b21] leading-normal markdown-body prose-compact">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.text}
              </ReactMarkdown>
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

          {/* Reactions display */}
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

        {/* Reaction picker trigger */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity relative">
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

const StatusIndicator = ({ status }: { status?: 'online' | 'away' | 'offline' }) => {
  if (!status) return null;
  const colors = {
    online: "bg-[#00a884]",
    away: "bg-[#ffbc38]",
    offline: "bg-[#8696a0]"
  };
  
  return (
    <div className={cn("w-2 h-2 rounded-full", colors[status])} title={status} />
  );
};

interface HeaderProps {
  user: any;
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
  onBack?: () => void;
  isMobile: boolean;
}

const Header: React.FC<HeaderProps> = ({ user, toggleSidebar, isSidebarOpen, onBack, isMobile }) => (
  <header className="h-[60px] bg-[#f0f2f5] flex items-center justify-between px-4 py-2 sticky top-0 z-10 shrink-0 border-r border-gray-200 shadow-sm safe-top">
    <div className="flex items-center gap-4">
      {isMobile && onBack ? (
        <button onClick={onBack} className="p-1 hover:bg-gray-200 rounded-full transition-colors mr-1">
          <ArrowRight className="text-[#54656f] w-6 h-6" />
        </button>
      ) : (
        <button onClick={toggleSidebar} className="md:hidden p-1 hover:bg-gray-200 rounded-full transition-colors">
          {isSidebarOpen ? <X className="text-[#54656f]" /> : <Menu className="text-[#54656f]" />}
        </button>
      )}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden border border-gray-200">
          <img src={isMobile && onBack ? 'https://picsum.photos/seed/noa-ai/100' : (user?.photoURL || 'https://picsum.photos/seed/user/100')} alt="Avatar" referrerPolicy="no-referrer" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-[#111b21] leading-tight">
            {isMobile && onBack ? 'נועה AI (SabanOS)' : 'SabanOS'}
          </h2>
          <span className="text-[10px] text-green-600 font-medium tracking-wide">זמין כעת</span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-4 text-[#54656f]">
      <Search className="w-5 h-5 cursor-pointer" />
      <MoreVertical className="w-5 h-5 cursor-pointer" />
      <button onClick={signOut} className="p-1 hover:bg-gray-200 rounded-full">
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  </header>
);

interface InputAreaProps {
  onSendMessage: (msg: string) => void;
  onSendFile: (file: File) => void;
  onSendAudio: (blob: Blob, duration: number) => void;
  isTyping: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, onSendFile, onSendAudio, isTyping }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (recordingDuration > 1) {
          onSendAudio(audioBlob, recordingDuration);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null; // Prevent sending
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleConfirmSend = () => {
    if (pendingFile) {
      onSendFile(pendingFile);
      clearPendingFile();
    }
  };

  const clearPendingFile = () => {
    setPendingFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDuration = (sec: number) => {
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#f0f2f5] min-h-[62px] py-2 px-3 flex flex-col gap-2 sticky bottom-0 z-10 border-t border-gray-300">
      <AnimatePresence>
        {pendingFile && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-full left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-2xl flex flex-col gap-4 z-50 rounded-t-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">תצוגה מקדימה לפני שליחה</h3>
              <button onClick={clearPendingFile} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 max-h-[40vh] overflow-hidden">
              {pendingFile.type.startsWith('image/') ? (
                <img src={previewUrl!} alt="Preview" className="w-24 h-24 object-cover rounded shadow-sm border border-white" />
              ) : pendingFile.type === 'application/pdf' ? (
                <div className="w-24 h-24 bg-red-50 rounded flex items-center justify-center text-red-500">
                  <FileText className="w-12 h-12" />
                </div>
              ) : (
                <div className="w-24 h-24 bg-[#00a884]/10 rounded flex items-center justify-center text-[#00a884]">
                  <FileText className="w-12 h-12" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{pendingFile.name}</p>
                <p className="text-xs text-gray-500">{(pendingFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={clearPendingFile}
                className="flex-1 py-3 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                ביטול
              </button>
              <button 
                onClick={handleConfirmSend}
                className="flex-[2] py-3 text-sm font-medium text-white bg-[#00a884] hover:bg-[#008f72] rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                שלח קובץ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
        />
        {!isRecording ? (
          <>
            <div className="flex gap-3 text-[#54656f]">
              <Smile className="w-6 h-6 cursor-pointer" />
              <Paperclip 
                className="w-6 h-6 cursor-pointer" 
                onClick={() => fileInputRef.current?.click()}
              />
            </div>
            <div className="flex-1 relative">
              <input 
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="הקלד הודעה"
                className="w-full bg-white rounded-lg px-4 py-2 text-sm focus:outline-none placeholder:text-gray-500 shadow-sm"
              />
              {isTyping && (
                <div className="absolute -top-6 right-2 text-[10px] italic text-[#00a884] font-medium bg-[#f0f2f5] px-2 rounded-full animate-pulse">
                  נועה מקלידה...
                </div>
              )}
            </div>
            {text.trim() ? (
              <Send 
                onClick={handleSend}
                className="w-6 h-6 text-[#00a884] cursor-pointer" 
              />
            ) : (
              <Mic 
                onClick={startRecording}
                className="w-6 h-6 text-[#54656f] cursor-pointer hover:text-[#00a884] transition-colors" 
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-red-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono text-gray-700">{formatDuration(recordingDuration)}</span>
            </div>
            <p className="text-xs text-gray-400">הקלטה פעילה...</p>
            <div className="flex items-center gap-4">
              <Trash2 
                onClick={cancelRecording}
                className="w-5 h-5 text-gray-400 cursor-pointer hover:text-red-500 transition-colors" 
              />
              <div className="w-[1px] h-4 bg-gray-200" />
              <div 
                onClick={stopRecording}
                className="w-8 h-8 bg-[#00a884] rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-[#008f72] transition-colors"
              >
                <Send className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNoaTyping, setIsNoaTyping] = useState(false);
  const [activeView, setActiveView] = useState<'sidebar' | 'chat'>('sidebar');
  const [isMobile, setIsMobile] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleActiveViewChange = (view: 'sidebar' | 'chat') => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setActiveView(view);
    setTimeout(() => setIsTransitioning(false), 400); // Buffer for animation
  };

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => {
      const isMob = window.innerWidth < 768;
      setIsMobile(isMob);
      if (!isMob) setActiveView('chat'); // Always show chat on desktop
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Orders Real-time Bridge & Notifications
  useEffect(() => {
    if (!user) return;

    // Request notification permission once
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    const q = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const order = change.doc.data() as Order;
          const orderTime = order.createdAt?.toMillis() || 0;
          const now = Date.now();
          
          // Only notify for fresh orders (last 30 seconds) not created by Noa itself to avoid loops
          if (now - orderTime < 30000 && order.createdBy !== 'noa') {
            const chatId = `chat_${user.uid}_noa`;
            
            // Add automatic Noa message to chat (WhatsApp Interface Simulation)
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
              text: `📢 [Saban Messenger - קבוצת נהגים]\n\n🚀 ראמי נשמה, נכנסה הזמנה חדשה בסידור!\n\n🔹 לקוח: ${order.customer}\n🔹 פריטים: ${Array.isArray(order.items) ? order.items.join(', ') : (order.items || 'לא צוין')}\n🔹 יעד: ${order.destination || 'ממתין לעדכון'}\n\nהמערכת בודקת כרגע זמינות נהגים...`,
              senderId: 'noa',
              senderName: 'Saban Messenger',
              status: 'sent',
              type: 'text',
              createdAt: serverTimestamp()
            });

            // Native Push Notification Simulation
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Saban Messenger (WhatsApp)", {
                body: `הזמנה חדשה מ-${order.customer} - ${order.destination || ''}`,
                icon: "https://picsum.photos/seed/sabanos/192/192"
              });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);
  
  // Sound effects
  const playTick = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    audio.play().catch(() => {});
  };

  const playAICompletion = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audio.play().catch(() => {});
  };

  useEffect(() => {
    if (!user) return;

    // Use a fixed chat ID for "Noa" logic per user
    const chatId = `chat_${user.uid}_noa`;

    // Ensure the chat exists
    const chatRef = doc(db, 'chats', chatId);
    setDoc(chatRef, {
      participants: [user.uid, 'noa'],
      updatedAt: serverTimestamp(),
      title: 'נועה AI'
    }, { merge: true });

    // Listen for messages
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
    });
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isNoaTyping]);

  const handleSendMessage = async (text: string) => {
    if (!user) return;
    const chatId = `chat_${user.uid}_noa`;
    
    // Play sound immediately for better UX
    playTick();

    const msgData = {
      text,
      senderId: user.uid,
      senderName: user.displayName || 'User',
      status: 'sent',
      type: 'text',
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
    
    // AI Response logic
    handleAIResponse(text);
  };

  const handleSendFile = async (file: File) => {
    if (!user) return;
    const chatId = `chat_${user.uid}_noa`;
    
    playTick();

    const fileUrl = URL.createObjectURL(file);
    let fileContent = '';

    // Read text file content for preview
    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.json')) {
      try {
        fileContent = await file.text();
      } catch (err) {
        console.error("Failed to read file", err);
      }
    }
    
    const msgData = {
      text: `שלחתי קובץ: ${file.name}`,
      senderId: user.uid,
      senderName: user.displayName || 'User',
      status: 'sent',
      type: 'file',
      fileName: file.name,
      fileUrl: fileUrl,
      fileContent: fileContent,
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
    handleAIAnalysis(file);
  };

  const handleSendAudio = async (blob: Blob, duration: number) => {
    if (!user) return;
    const chatId = `chat_${user.uid}_noa`;
    
    playTick();

    const fileUrl = URL.createObjectURL(blob);
    
    const msgData = {
      text: `שלחתי הודעה קולית (${duration} שניות)`,
      senderId: user.uid,
      senderName: user.displayName || 'User',
      status: 'sent',
      type: 'audio' as const,
      fileUrl: fileUrl,
      duration: duration,
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
    handleAIResponse(`קיבלתי את ההודעה הקולית שלך. מה תרצה שאעשה איתה?`);
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;
    const chatId = `chat_${user.uid}_noa`;
    const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const reactions = { ...(message.reactions || {}) };
    const userIds = reactions[emoji] || [];

    if (userIds.includes(user.uid)) {
      reactions[emoji] = userIds.filter(id => id !== user.uid);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...userIds, user.uid];
    }

    await updateDoc(msgRef, { reactions });
  };

  const handleAIAnalysis = async (file: File) => {
    if (!ai || !user) return;
    setIsNoaTyping(true);
    const chatId = `chat_${user.uid}_noa`;

    try {
      let analysisPrompt = `The user has uploaded a file named "${file.name}" (type: ${file.type || 'unknown'}). `;
      
      // If it's a small enough representative file or we want to simulate deep analysis:
      // For now, we use a prompt that describes the context to Noa.
      analysisPrompt += `Please provide a professional logistics summary of this file and suggest the next steps for the Saban team.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: analysisPrompt,
        config: {
          systemInstruction: NOA_SYSTEM_INSTRUCTION
        }
      });

      const reply = response.text || "קלטתי את הקובץ, אבל אני צריכה עוד רגע לעבד אותו. מה התוכנית?";
      
      setTimeout(async () => {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          text: reply,
          senderId: 'noa',
          senderName: 'Noa AI',
          status: 'sent',
          type: 'text',
          createdAt: serverTimestamp()
        });
        playAICompletion();
        setIsNoaTyping(false);
      }, 2000);

    } catch (error) {
      console.error("Analysis Error:", error);
      setIsNoaTyping(false);
    }
  };

  const handleAIResponse = async (userText: string) => {
    if (!ai || !user) return;
    setIsNoaTyping(true);
    const chatId = `chat_${user.uid}_noa`;

    try {
      // Mark user messages as read
      const userMsgsQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        where('senderId', '==', user.uid),
        where('status', '==', 'sent')
      );
      
      getDocs(userMsgsQuery).then(snapshot => {
        snapshot.forEach(d => {
          updateDoc(doc(db, 'chats', chatId, 'messages', d.id), { status: 'read' });
        });
      });

      const reply = await processNoaTurn(userText, user) || "סליחה, אירעה שגיאה בעיבוד הבקשה.";
      
      // Simulate delay for natural feel
      setTimeout(async () => {
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          text: reply,
          senderId: 'noa',
          senderName: 'Noa AI',
          status: 'sent',
          type: 'text',
          createdAt: serverTimestamp()
        });
        playAICompletion();
        setIsNoaTyping(false);
      }, 500); // Shorter delay as service already has its own processing time

    } catch (error) {
      console.error("AI Error:", error);
      setIsNoaTyping(false);
    }
  };

  if (!user) {
    return (
      <div className="h-screen bg-[#f0f2f5] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-[#00a884] rounded-full flex items-center justify-center mx-auto mb-6 text-white">
            <MessageSquare className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-[#111b21] mb-2">SabanOS</h1>
          <p className="text-gray-500 mb-8">מערכת ניהול לוגיסטיקה חכמה ומסונכרנת</p>
          <button 
            onClick={signIn}
            className="w-full bg-[#00a884] hover:bg-[#008f72] text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            <User className="w-5 h-5" />
            התחברות עם Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#dadbd3] flex overflow-hidden font-sans select-none touch-pan-y" dir="rtl">
      {/* Sidebar - Contacts */}
      <AnimatePresence mode="wait">
        {(!isMobile || activeView === 'sidebar') && (
          <motion.div 
            initial={isMobile ? { x: "100%" } : false}
            animate={{ x: 0 }}
            exit={isMobile ? { x: "100%" } : { opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "bg-white border-l border-gray-300 flex flex-col z-20 transition-all shadow-lg overflow-hidden",
              isMobile ? "fixed inset-0 w-full" : "relative w-[30%] lg:w-[25%] md:shadow-none"
            )}
          >
            <div className="h-[60px] bg-[#f0f2f5] flex items-center justify-between px-4 shrink-0 border-b border-gray-300 safe-top">
              <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden border border-gray-200">
                <img src={user?.photoURL || ''} alt="Me" referrerPolicy="no-referrer" />
              </div>
              <div className="flex gap-5 text-[#54656f]">
                <CircleDashed className="w-5 h-5 cursor-pointer hover:text-[#00a884] transition-colors" />
                <MessageSquare className="w-5 h-5 cursor-pointer hover:text-[#00a884] transition-colors" />
                <MoreVertical className="w-5 h-5 cursor-pointer hover:text-[#00a884] transition-colors" />
              </div>
            </div>

            <div className="p-3 bg-white shrink-0">
              <div className="bg-[#f0f2f5] rounded-xl flex items-center px-3 py-2 gap-4">
                <Search className="w-4 h-4 text-gray-500 shrink-0" />
                <input 
                  placeholder="חיפוש מהיר או משימה חדשה..."
                  className="bg-transparent text-sm w-full focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div 
                onClick={() => isMobile && handleActiveViewChange('chat')}
                className="flex items-center px-4 py-3 gap-3 bg-[#f0f2f5] cursor-pointer hover:bg-white transition-colors border-b border-gray-100 active:bg-gray-200"
              >
                <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white shrink-0 overflow-hidden shadow-sm">
                  <img src="https://picsum.photos/seed/noa-ai/100" alt="Noa AI" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#111b21] truncate">נועה AI (SabanOS)</h3>
                      <StatusIndicator status="online" />
                    </div>
                    <span className="text-[10px] text-[#00a884] font-medium">עכשיו</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                    {isNoaTyping ? (
                      <span className="text-[#00a884] italic animate-pulse">מקלידה...</span>
                    ) : (
                      messages[messages.length - 1]?.text || 'SabanOS מוכנה לפעולה'
                    )}
                  </p>
                </div>
                {isMobile && <ChevronLeft className="w-4 h-4 text-gray-300" />}
              </div>
              
              {/* Demo Contacts */}
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-white opacity-80 active:bg-gray-100">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden shrink-0">
                    <img src={`https://picsum.photos/seed/user-${i}/100`} alt="demo" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-[#111b21] truncate">צוות שטח {i}</h3>
                        <StatusIndicator status={i % 2 === 0 ? 'online' : 'offline'} />
                      </div>
                      <span className="text-[10px] text-gray-400">14:50</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate italic">משימה בטיפול...</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Bottom Nav */}
            {isMobile && (
              <div className="h-[70px] bg-[#f0f2f5] border-t border-gray-200 flex items-center justify-around px-6 safe-bottom shrink-0">
                <div className="flex flex-col items-center gap-1 text-[#00a884] cursor-pointer">
                  <MessageSquare className="w-6 h-6" />
                  <span className="text-[10px] font-bold">צ'אטים</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-gray-400 cursor-pointer">
                  <LayoutGrid className="w-6 h-6" />
                  <span className="text-[10px]">משימות</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-gray-400 cursor-pointer">
                  <Settings className="w-6 h-6" />
                  <span className="text-[10px]">הגדרות</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <AnimatePresence mode="wait">
        {(!isMobile || activeView === 'chat') && (
          <motion.div 
            initial={isMobile ? { x: "-100%" } : false}
            animate={{ x: 0 }}
            exit={isMobile ? { x: "-100%" } : { opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="flex-1 flex flex-col h-full bg-[#efeae2] relative shadow-inner overflow-hidden"
          >
            <Header 
              user={user} 
              toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
              isSidebarOpen={isSidebarOpen} 
              isMobile={isMobile}
              onBack={isMobile ? () => handleActiveViewChange('sidebar') : undefined}
            />
        
        {/* Messages List */}
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

          <InputArea 
            onSendMessage={handleSendMessage} 
            onSendFile={handleSendFile} 
            onSendAudio={handleSendAudio}
            isTyping={isNoaTyping} 
          />
        </motion.div>
      )}
    </AnimatePresence>

    <style>{`
      html, body, #root {
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        overscroll-behavior-y: none;
      }

      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 10px;
      }
      
      @supports (padding-top: env(safe-area-inset-top)) {
        .safe-top {
          padding-top: env(safe-area-inset-top);
          min-height: calc(60px + env(safe-area-inset-top));
        }
        .safe-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
      }

      /* Fix mobile tapping and layout */
      * {
        -webkit-tap-highlight-color: transparent;
      }
      
      body {
        -webkit-overflow-scrolling: touch;
      }

      .touch-pan-y {
        touch-action: pan-y;
      }

      input, p, h1, h2, h3, span {
        user-select: text;
      }
    `}</style>
  </div>
);
}
