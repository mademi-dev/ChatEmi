import type { ReactNode } from "react";

export type ChatEmiID = string;

export type ChatEmiConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export type ChatEmiConversationType = "direct" | "group" | "channel" | "bot";

export type ChatEmiMessageStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "failed";

export type ChatEmiPresenceStatus = "online" | "offline" | "away" | "busy" | "invisible";

export type ChatEmiAttachmentKind = "image" | "video" | "audio" | "voice" | "file" | "location" | "contact";

export interface ChatEmiUser {
  id: ChatEmiID;
  name: string;
  username?: string;
  avatarUrl?: string;
  statusText?: string;
  presence?: ChatEmiPresenceStatus;
  lastSeenAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiAttachment {
  id: ChatEmiID;
  type: ChatEmiAttachmentKind;
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiReaction {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
  users?: ChatEmiUser[];
}

export interface ChatEmiMessage {
  id: ChatEmiID;
  conversationId: ChatEmiID;
  sender: ChatEmiUser;
  text?: string;
  html?: string;
  attachments?: ChatEmiAttachment[];
  replyTo?: ChatEmiMessage;
  forwardedFrom?: ChatEmiUser;
  reactions?: ChatEmiReaction[];
  status?: ChatEmiMessageStatus;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  deletedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiConversation {
  id: ChatEmiID;
  type: ChatEmiConversationType;
  title?: string;
  description?: string;
  avatarUrl?: string;
  participants: ChatEmiUser[];
  lastMessage?: ChatEmiMessage;
  unreadCount?: number;
  mutedUntil?: string | null;
  pinned?: boolean;
  archived?: boolean;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiPage<T> {
  items: T[];
  nextCursor?: string | null;
}

export interface ChatEmiListOptions {
  cursor?: string;
  limit?: number;
}

export interface ChatEmiMessageListOptions extends ChatEmiListOptions {
  beforeId?: ChatEmiID;
  afterId?: ChatEmiID;
}

export interface ChatEmiSendMessageInput {
  conversationId: ChatEmiID;
  text?: string;
  html?: string;
  attachments?: ChatEmiAttachment[];
  replyToId?: ChatEmiID;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiEditMessageInput {
  conversationId: ChatEmiID;
  messageId: ChatEmiID;
  text?: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiCreateConversationInput {
  type: ChatEmiConversationType;
  participantIds: ChatEmiID[];
  title?: string;
  description?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiUploadAttachmentInput {
  file: File | Blob;
  conversationId?: ChatEmiID;
  name?: string;
  type?: ChatEmiAttachmentKind;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiTypingEvent {
  conversationId: ChatEmiID;
  user: ChatEmiUser;
  isTyping: boolean;
  expiresAt?: string;
}

export interface ChatEmiReceiptEvent {
  conversationId: ChatEmiID;
  messageIds: ChatEmiID[];
  userId: ChatEmiID;
  status: Extract<ChatEmiMessageStatus, "delivered" | "read">;
  at: string;
}

export interface ChatEmiPresenceEvent {
  userId: ChatEmiID;
  status: ChatEmiPresenceStatus;
  lastSeenAt?: string;
}

export interface ChatEmiSocketEnvelope<TType extends string = string, TPayload = unknown> {
  type: TType;
  payload: TPayload;
  requestId?: string;
}

export interface ChatEmiSocketEventMap {
  connected: undefined;
  disconnected: CloseEvent | undefined;
  error: Event | Error;
  reconnecting: { attempt: number; delay: number };
  "conversation.created": ChatEmiConversation;
  "conversation.updated": ChatEmiConversation;
  "conversation.deleted": { conversationId: ChatEmiID };
  "message.created": ChatEmiMessage;
  "message.updated": ChatEmiMessage;
  "message.deleted": { conversationId: ChatEmiID; messageId: ChatEmiID };
  "message.receipt": ChatEmiReceiptEvent;
  "message.reaction": { conversationId: ChatEmiID; messageId: ChatEmiID; reactions: ChatEmiReaction[] };
  typing: ChatEmiTypingEvent;
  presence: ChatEmiPresenceEvent;
  notification: Record<string, unknown>;
}

export type ChatEmiSocketEventName = keyof ChatEmiSocketEventMap;

export type ChatEmiSocketHandler<TName extends ChatEmiSocketEventName> = (payload: ChatEmiSocketEventMap[TName]) => void;

export interface ChatEmiEndpointOverrides {
  me?: string;
  conversations?: string;
  conversation?: (conversationId: ChatEmiID) => string;
  messages?: (conversationId: ChatEmiID) => string;
  message?: (conversationId: ChatEmiID, messageId: ChatEmiID) => string;
  markRead?: (conversationId: ChatEmiID) => string;
  reactions?: (conversationId: ChatEmiID, messageId: ChatEmiID) => string;
  upload?: string;
  search?: string;
}

export interface ChatEmiConfig {
  apiBaseUrl: string;
  socketUrl?: string;
  token?: string | (() => string | Promise<string | undefined> | undefined);
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  currentUser?: ChatEmiUser;
  fetchImpl?: typeof fetch;
  websocketFactory?: (url: string) => WebSocket;
  endpoints?: ChatEmiEndpointOverrides;
  reconnect?: {
    enabled?: boolean;
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
}

export interface ChatEmiProviderProps {
  children: ReactNode;
  config: ChatEmiConfig;
  autoConnect?: boolean;
  initialConversations?: ChatEmiConversation[];
  initialActiveConversationId?: ChatEmiID;
}

export interface ChatEmiState {
  currentUser?: ChatEmiUser;
  conversations: ChatEmiConversation[];
  activeConversationId?: ChatEmiID;
  messagesByConversation: Record<ChatEmiID, ChatEmiMessage[]>;
  typingByConversation: Record<ChatEmiID, ChatEmiTypingEvent[]>;
  presenceByUser: Record<ChatEmiID, ChatEmiPresenceEvent>;
  connectionStatus: ChatEmiConnectionStatus;
  loading: boolean;
  error?: string;
}

export interface ChatEmiMessengerProps {
  className?: string;
  emptyState?: ReactNode;
  composerPlaceholder?: string;
  showSidebar?: boolean;
  renderConversation?: (conversation: ChatEmiConversation, isActive: boolean) => ReactNode;
  renderMessage?: (message: ChatEmiMessage, isMine: boolean) => ReactNode;
}
