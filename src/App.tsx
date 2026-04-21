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
  Maximize2,
  History, Warehouse, Users,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCustomerDisplay, getItemsDisplay } from './lib/orderUtils';
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
import { OrderHistory } from './components/OrderHistory';
import { DeepDiveCard } from './components/DeepDiveCard';
import { NoaChat } from './components/NoaChat';
import { WarehouseDashboard } from './components/WarehouseDashboard';
import { StaffSettings } from './components/StaffSettings';

// --- Components ---

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
  const [activeView, setActiveView] = useState<'sidebar' | 'chat' | 'history' | 'warehouse' | 'staff'>('sidebar');
  const [historyOrderId, setHistoryOrderId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  // Focus tracking
  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleActiveViewChange = (view: 'sidebar' | 'chat' | 'history' | 'warehouse' | 'staff') => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setActiveView(view as any);
    if (view !== 'history') setHistoryOrderId(null); // Reset when leaving history
    setTimeout(() => setIsTransitioning(false), 400); // Buffer for animation
  };

  const handleNavigateToOrderHistory = (orderId: string) => {
    setHistoryOrderId(orderId);
    handleActiveViewChange('history');
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
          
          if (now - orderTime < 30000 && order.createdBy !== 'noa') {
            const chatId = `chat_${user.uid}_noa`;
            const customerDisplay = getCustomerDisplay(order);
            const itemsDisplay = getItemsDisplay(order.items);
            
            // Check for Itzik's profile to personalize
            let noaMessage = `📢 [Saban Messenger - קבוצת נהגים]\n\n🚀 ראמי נשמה, נכנסה הזמנה חדשה בסידור!\n\n🔹 לקוח: ${customerDisplay}\n🔹 פריטים: ${itemsDisplay}\n🔹 יעד: ${order.destination || 'ממתין לעדכון'}\n\nהמערכת בודקת כרגע זמינות נהגים...`;
            
            try {
              const profileSnap = await getDocs(query(collection(db, 'profiles'), where('email', '==', user.email)));
              if (!profileSnap.empty) {
                const profile = profileSnap.docs[0].data();
                if (profile.name.includes('איציק')) {
                  noaMessage = `איציק, רשמתי לך ביומן להכין את הציוד ל${customerDisplay} (${itemsDisplay}) לשעה הקרובה.`;
                  
                  // Auto-create calendar event in reminders as well
                  await addDoc(collection(db, 'reminders'), {
                    summary: `הכנת ציוד: ${customerDisplay}`,
                    description: `פריטים: ${itemsDisplay}`,
                    startTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
                    userEmail: user.email,
                    status: 'pending',
                    reminderSent: false,
                    createdAt: serverTimestamp()
                  });
                }
              }
            } catch (err) {
              console.warn("Could not fetch profile for personalized messaging", err);
            }

            // Add automatic Noa message to chat
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
              text: noaMessage,
              senderId: 'noa',
              senderName: 'Saban Messenger',
              status: 'sent',
              type: 'text',
              createdAt: serverTimestamp()
            });

            // Native Push Notification Simulation
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Saban Messenger (WhatsApp)", {
                body: `הזמנה חדשה מ-${customerDisplay} - ${order.destination || ''}`,
                icon: "https://picsum.photos/seed/sabanos/192/192"
              });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);
  
  // Calendar Reminder Engine
  useEffect(() => {
    if (!user) return;
    
    const checkReminders = async () => {
      try {
        const now = new Date();
        const futureLimit = new Date(now.getTime() + 35 * 60000); // 35 minutes from now
        
        const q = query(
          collection(db, 'reminders'),
          where('userEmail', '==', user.email),
          where('status', '==', 'pending'),
          where('reminderSent', '==', false)
        );
        
        const snap = await getDocs(q);
        for (const docRef of snap.docs) {
          const reminder = docRef.data();
          const startTime = new Date(reminder.startTime);
          
          // If within 30-35 mins window
          if (startTime > now && startTime <= futureLimit) {
            const chatId = `chat_${user.uid}_noa`;
            
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
              text: `⏰ *תזכורת יומן:* איציק, עוד חצי שעה יש לך: ${reminder.summary}\n\n${reminder.description || ''}`,
              senderId: 'noa',
              senderName: 'Noa AI Reminders',
              status: 'sent',
              type: 'text',
              createdAt: serverTimestamp()
            });
            
            await updateDoc(docRef.ref, { reminderSent: true });
            playAICompletion();
          }
        }
      } catch (err) {
        console.error("Reminder engine error:", err);
      }
    };

    const interval = setInterval(checkReminders, 60000); // Check every minute
    return () => clearInterval(interval);
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

    const msgsUnsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msg = change.doc.data() as any;
          const msgTime = msg.createdAt?.toMillis() || Date.now();
          const now = Date.now();
          
          // Only notify if:
          // 1. It's from others (Noa)
          // 2. The message is fresh (within last 15 seconds)
          // 3. The window is not focused OR the chat is not the active view
          if (msg.senderId !== user.uid && (now - msgTime < 15000)) {
            if (!isFocused || (isMobile && activeView !== 'chat')) {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification(msg.senderName || "Saban Messenger", {
                  body: msg.text,
                  icon: "https://picsum.photos/seed/sabanos/192/192",
                  tag: 'saban-msg-' + msg.senderId
                });
              }
              playAICompletion(); // Play sound if not in focus
            }
          }
        }
      });

      const msgs: Message[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
    });

    return () => msgsUnsubscribe();
  }, [user, isFocused, isMobile, activeView]);

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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const markMessagesAsRead = async () => {
    if (!user) return;
    const chatId = `chat_${user.uid}_noa`;
    const userMsgsQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      where('senderId', '==', user.uid),
      where('status', '==', 'sent')
    );
    
    try {
      const snapshot = await getDocs(userMsgsQuery);
      const updates = snapshot.docs.map(d => 
        updateDoc(doc(db, 'chats', chatId, 'messages', d.id), { status: 'read' })
      );
      await Promise.all(updates);
    } catch (err) {
      console.error("Error marking messages as read:", err);
    }
  };

  const handleAIAnalysis = async (file: File) => {
    if (!ai || !user) return;
    setIsNoaTyping(true);
    const chatId = `chat_${user.uid}_noa`;

    try {
      const base64Data = await fileToBase64(file);
      const filePart = {
        inlineData: {
          mimeType: file.type || 'application/pdf',
          data: base64Data
        }
      };

      const analysisPrompt = `משתמש העלה קובץ בשם "${file.name}". בצע ניתוח לוגיסטי. אם מדובר בתעודת משלוח או הזמנה, שלוף את הנתונים והצג סיכום לראמי. אל תשכח לשאול "ראמי נשמה, שלפתי את הנתונים מה-PDF, להזין אותם כהזמנה חדשה ללוח?" כפי שמופיע בהנחיות המערכת שלך.`;

      const reply = await processNoaTurn(analysisPrompt, user, messages, filePart) || "קלטתי את הקובץ, אבל אני צריכה עוד רגע לעבד אותו. מה התוכנית?";
      
      // Mark as read after Processing is complete
      await markMessagesAsRead();

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
      }, 1000);

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
      const reply = await processNoaTurn(userText, user, messages) || "סליחה, אירעה שגיאה בעיבוד הבקשה.";
      
      // Mark user messages as read once Noa finishes processing
      await markMessagesAsRead();
      
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
                onClick={() => handleActiveViewChange('chat')}
                className={cn(
                  "flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-white transition-colors border-b border-gray-100 active:bg-gray-200",
                  activeView === 'chat' ? "bg-[#f0f2f5]" : "bg-white"
                )}
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

              <div className="px-4 py-2 bg-gray-50 border-y border-gray-100 italic text-[10px] text-gray-400 font-bold tracking-widest uppercase shrink-0">
                 ניהול ומעקב
              </div>
              <div 
                onClick={() => handleActiveViewChange('history')}
                className={cn(
                  "flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-[#f0f2f5] transition-all border-b border-gray-100 group active:bg-gray-200",
                  activeView === 'history' && "bg-[#f0f2f5] border-r-4 border-[#00a884] shadow-inner"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm",
                  activeView === 'history' ? "bg-[#00a884] text-white" : "bg-gray-100 text-[#54656f] group-hover:bg-[#00a884] group-hover:text-white"
                )}>
                  <History className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "text-sm font-semibold truncate",
                    activeView === 'history' ? "text-[#00a884]" : "text-[#111b21]"
                  )}>היסטוריית הזמנות</h3>
                  <p className="text-[11px] text-gray-400 truncate">דו"ח ביצועים וסינון חכם</p>
                </div>
                <ChevronLeft className={cn(
                  "w-4 h-4 transition-all opacity-0 group-hover:opacity-100",
                  activeView === 'history' ? "text-[#00a884] opacity-100" : "text-gray-300"
                )} />
              </div>

              <div 
                onClick={() => handleActiveViewChange('warehouse')}
                className={cn(
                  "flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-[#f0f2f5] transition-all border-b border-gray-100 group active:bg-gray-200",
                  activeView === 'warehouse' && "bg-[#f0f2f5] border-r-4 border-[#00a884] shadow-inner"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm",
                  activeView === 'warehouse' ? "bg-[#00a884] text-white" : "bg-white text-[#00a884] group-hover:bg-[#00a884] group-hover:text-white border border-[#00a884]/20"
                )}>
                  <Warehouse className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "text-sm font-semibold truncate",
                    activeView === 'warehouse' ? "text-[#00a884]" : "text-[#111b21]"
                  )}>דשבורד מחסנים</h3>
                  <p className="text-[11px] text-gray-400 truncate">ניהול העמסה לפי חלוקת מחסנים</p>
                </div>
                <ChevronLeft className={cn(
                  "w-4 h-4 transition-all opacity-0 group-hover:opacity-100",
                  activeView === 'warehouse' ? "text-[#00a884] opacity-100" : "text-gray-300"
                )} />
              </div>

              <div 
                onClick={() => handleActiveViewChange('staff')}
                className={cn(
                  "flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-[#f0f2f5] transition-all border-b border-gray-100 group active:bg-gray-200",
                  activeView === 'staff' && "bg-[#f0f2f5] border-r-4 border-r-[#00a884] shadow-inner"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm",
                  activeView === 'staff' ? "bg-[#111b21] text-white" : "bg-white text-[#54656f] group-hover:bg-[#111b21] group-hover:text-white border border-gray-100"
                )}>
                  <Users className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "text-sm font-semibold truncate",
                    activeView === 'staff' ? "text-[#111b21]" : "text-[#111b21]"
                  )}>הגדרות צוות</h3>
                  <p className="text-[11px] text-gray-400 truncate">ניהול פרופילים וקופסה שחורה</p>
                </div>
                <ChevronLeft className={cn(
                  "w-4 h-4 transition-all opacity-0 group-hover:opacity-100",
                  activeView === 'staff' ? "text-[#111b21] opacity-100" : "text-gray-300"
                )} />
              </div>

              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 italic text-[10px] text-gray-400 font-bold tracking-widest uppercase shrink-0">
                 צוותים פעילים
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
                <div 
                  onClick={() => handleActiveViewChange('sidebar')}
                  className={cn(
                    "flex flex-col items-center gap-1 cursor-pointer",
                    activeView === 'sidebar' ? "text-[#00a884]" : "text-gray-400 font-medium"
                  )}
                >
                  <MessageSquare className="w-6 h-6" />
                  <span className="text-[10px]">צ'אטים</span>
                </div>
                <div 
                  onClick={() => handleActiveViewChange('history')}
                  className={cn(
                    "flex flex-col items-center gap-1 cursor-pointer",
                    activeView === 'history' ? "text-[#00a884]" : "text-gray-400 font-medium"
                  )}
                >
                  <History className="w-6 h-6" />
                  <span className="text-[10px]">היסטוריה</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-gray-400 cursor-pointer opacity-40">
                  <Settings className="w-6 h-6" />
                  <span className="text-[10px]">הגדרות</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Area */}
      <AnimatePresence mode="wait">
        {(!isMobile || activeView === 'chat' || activeView === 'history' || activeView === 'warehouse') && (
          <motion.div 
            key={activeView}
            initial={isMobile ? { x: "-100%" } : { opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={isMobile ? { x: "-100%" } : { opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="flex-1 flex flex-col h-full bg-[#efeae2] relative shadow-inner overflow-hidden"
          >
            {activeView === 'history' ? (
              <OrderHistory 
                onBack={() => handleActiveViewChange(isMobile ? 'sidebar' : 'chat')} 
                selectedOrderId={historyOrderId || undefined} 
              />
            ) : activeView === 'warehouse' ? (
              <WarehouseDashboard onBack={() => handleActiveViewChange(isMobile ? 'sidebar' : 'chat')} />
            ) : activeView === 'staff' ? (
              <StaffSettings onBack={() => handleActiveViewChange(isMobile ? 'sidebar' : 'chat')} />
            ) : (
              <>
                <Header 
                  user={user} 
                  toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
                  isSidebarOpen={isSidebarOpen} 
                  isMobile={isMobile}
                  onBack={isMobile ? () => handleActiveViewChange('sidebar') : undefined}
                />
                <NoaChat
                  messages={messages} 
                  isNoaTyping={isNoaTyping} 
                  user={user} 
                  handleReact={handleReact} 
                  messagesEndRef={messagesEndRef}
                  onNavigateToHistory={handleNavigateToOrderHistory}
                />

                <InputArea 
                  onSendMessage={handleSendMessage} 
                  onSendFile={handleSendFile} 
                  onSendAudio={handleSendAudio}
                  isTyping={isNoaTyping} 
                />
              </>
            )}
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
