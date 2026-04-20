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
  User
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
import { ChatMetadata, Message, UserProfile } from './types';
import { ai, NOA_SYSTEM_INSTRUCTION } from './lib/ai';

// --- Components ---

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMe }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        "flex w-full mb-2",
        isMe ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[65%] px-2 py-1.5 rounded-lg shadow-sm relative",
          isMe ? "bg-[#d9fdd3] rounded-tr-none" : "bg-white rounded-tl-none"
        )}
      >
        {message.type === 'file' ? (
          <a 
            href={message.fileUrl} 
            download={message.fileName} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-black/5 rounded-md mb-1 border border-gray-100 hover:bg-black/10 transition-colors cursor-pointer"
          >
            <div className="bg-[#00a884] p-3 rounded text-white">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0 mx-3">
              <p className="text-sm font-medium truncate">{message.fileName || 'קובץ'}</p>
              <p className="text-[10px] text-gray-500 uppercase">
                {message.fileName?.split('.').pop()?.toUpperCase() || 'FILE'}
              </p>
            </div>
            <Download className="w-6 h-6 text-[#8696a0]" />
          </a>
        ) : (
          <p className="text-[14.2px] text-[#111b21] whitespace-pre-wrap leading-normal">{message.text}</p>
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
}

const Header: React.FC<HeaderProps> = ({ user, toggleSidebar, isSidebarOpen }) => (
  <header className="h-[60px] bg-[#f0f2f5] flex items-center justify-between px-4 py-2 sticky top-0 z-10 shrink-0 border-r border-gray-200 shadow-sm">
    <div className="flex items-center gap-4">
      <button onClick={toggleSidebar} className="md:hidden p-1 hover:bg-gray-200 rounded-full transition-colors">
        {isSidebarOpen ? <X className="text-[#54656f]" /> : <Menu className="text-[#54656f]" />}
      </button>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
          <img src={user?.photoURL || 'https://picsum.photos/seed/user/100'} alt="Avatar" referrerPolicy="no-referrer" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-sm font-medium text-[#111b21] leading-tight">נועה AI (Saban Logistics)</h2>
          <span className="text-xs text-gray-500">מחובר כעת</span>
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
  isTyping: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, onSendFile, isTyping }) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-[#f0f2f5] min-h-[62px] py-2 px-3 flex items-center gap-3 sticky bottom-0 z-10 border-t border-gray-300">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange}
      />
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
        <Mic className="w-6 h-6 text-[#54656f] cursor-pointer" />
      )}
    </div>
  );
};

export default function App() {
  const [user] = useAuthState(auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNoaTyping, setIsNoaTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Sound effect
  const playTick = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
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
    
    const msgData = {
      text: `שלחתי קובץ: ${file.name}`,
      senderId: user.uid,
      senderName: user.displayName || 'User',
      status: 'sent',
      type: 'file',
      fileName: file.name,
      fileUrl: fileUrl,
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
    
    // Trigger AI Analysis instead of generic response
    handleAIAnalysis(file);
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
      // Mark user messages as read when Noa starts typing or responding
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
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userText,
        config: {
          systemInstruction: NOA_SYSTEM_INSTRUCTION
        }
      });

      const reply = response.text || "סליחה, אירעה שגיאה בעיבוד הבקשה.";
      
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
        setIsNoaTyping(false);
        // Maybe update all user messages to 'read'
      }, 1500);

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
          <h1 className="text-2xl font-bold text-[#111b21] mb-2">ברוכים הבאים ל-SabanMessenger</h1>
          <p className="text-gray-500 mb-8">התחברו כדי להתחיל לשוחח עם נועה AI ולנהל את הלוגיסטיקה שלכם</p>
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
    <div className="h-screen bg-[#dadbd3] flex overflow-hidden font-sans" dir="rtl">
      {/* Sidebar - Contacts */}
      <AnimatePresence>
        {(isSidebarOpen || window.innerWidth > 768) && (
          <motion.div 
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            className={cn(
              "bg-white border-l border-gray-300 flex flex-col z-20 transition-all shadow-lg",
              "fixed inset-y-0 right-0 w-[80%] md:relative md:w-[30%] lg:w-[25%] md:shadow-none"
            )}
          >
            <div className="h-[60px] bg-[#f0f2f5] flex items-center justify-between px-4 shrink-0 border-b border-gray-300">
              <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden">
                <img src={user?.photoURL || ''} alt="Me" referrerPolicy="no-referrer" />
              </div>
              <div className="flex gap-5 text-[#54656f]">
                <CircleDashed className="w-5 h-5 cursor-pointer" />
                <MessageSquare className="w-5 h-5 cursor-pointer" />
                <MoreVertical className="w-5 h-5 cursor-pointer" />
              </div>
            </div>

            <div className="p-2 bg-white">
              <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5 gap-4">
                <Search className="w-5 h-5 text-gray-500 shrink-0" />
                <input 
                  placeholder="חפש או התחל צ'אט חדש"
                  className="bg-transparent text-sm w-full focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center px-4 py-3 gap-3 bg-[#f0f2f5] cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-100">
                <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white shrink-0 overflow-hidden">
                  <img src="https://picsum.photos/seed/noa-ai/100" alt="Noa AI" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-[#111b21] truncate">נועה AI</h3>
                      <StatusIndicator status="online" />
                    </div>
                    <span className="text-[10px] text-gray-500">עכשיו</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {messages[messages.length - 1]?.text || 'התחילו לשוחח עם נועה...'}
                  </p>
                </div>
              </div>
              
              {/* Other demo contacts */}
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-white">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden shrink-0">
                    <img src={`https://picsum.photos/seed/user-${i}/100`} alt="demo" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-[#111b21] truncate">איש קשר {i}</h3>
                        <StatusIndicator status={i === 1 ? 'away' : i === 2 ? 'offline' : 'online'} />
                      </div>
                      <span className="text-[10px] text-gray-500">12:45</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">הנחיות לוגיסטיות...</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-[#efeae2] relative shadow-inner">
        <Header user={user} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
        
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10 space-y-2 custom-scrollbar">
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
            <MessageBubble key={m.id} message={m} isMe={m.senderId === user.uid} />
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

        <InputArea onSendMessage={handleSendMessage} onSendFile={handleSendFile} isTyping={isNoaTyping} />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}
