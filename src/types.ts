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
  type: 'text' | 'file' | 'audio';
  fileUrl?: string;
  fileName?: string;
  fileContent?: string; // For text file previews
  duration?: number;
  reactions?: Record<string, string[]>; // emoji -> list of userIds
  createdAt: Timestamp;
}

export interface Order {
  id?: string;
  orderNumber?: string;
  customer: string;
  customerName?: string;
  items: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'preparing' | 'ready';
  destination?: string;
  warehouse?: string;
  driverId?: string;
  driverName?: string;
  createdBy?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
