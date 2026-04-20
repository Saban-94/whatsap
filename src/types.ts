import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  status?: 'online' | 'away' | 'offline';
  isTyping?: boolean;
}

export interface ChatMetadata {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: Timestamp;
  title?: string;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  status: 'sent' | 'read';
  type: 'text' | 'file';
  fileUrl?: string;
  fileName?: string;
  createdAt: Timestamp;
}
