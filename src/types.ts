import type { ReactNode } from "react";

export type ChatEmiID = string;

export type ChatEmiConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export type ChatEmiConversationType = "direct" | "group" | "channel" | "bot";

export type ChatEmiMessageStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "failed";

export type ChatEmiPresenceStatus = "online" | "offline" | "away" | "busy" | "invisible";

export type ChatEmiAttachmentKind = "image" | "video" | "audio" | "voice" | "file" | "location" | "contact";

export type ChatEmiMessageKind = "text" | "media" | "voice" | "system";

export type ChatEmiMemberRole = "owner" | "admin" | "moderator" | "member" | "guest";

export type ChatEmiMemberPermission =
  | "send_messages"
  | "send_media"
  | "pin_messages"
  | "manage_messages"
  | "manage_members"
  | "manage_roles"
  | "manage_conversation"
  | "invite_members";

export type ChatEmiTheme = "light" | "dark" | "system";

export interface ChatEmiUser {
  id: ChatEmiID;
  name: string;
  username?: string;
  avatarUrl?: string;
  statusText?: string;
  presence?: ChatEmiPresenceStatus;
  lastSeenAt?: string;
  phoneNumber?: string;
  email?: string;
  verified?: boolean;
  bot?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiMember {
  user: ChatEmiUser;
  role: ChatEmiMemberRole;
  permissions?: ChatEmiMemberPermission[];
  joinedAt: string;
  invitedBy?: ChatEmiUser;
  mutedUntil?: string | null;
  bannedUntil?: string | null;
  title?: string;
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
  waveform?: number[];
  thumbnailUrl?: string;
  caption?: string;
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
  kind?: ChatEmiMessageKind;
  text?: string;
  html?: string;
  attachments?: ChatEmiAttachment[];
  replyTo?: ChatEmiMessage;
  replyToId?: ChatEmiID;
  forwardedFrom?: ChatEmiUser;
  forwardedFromConversationId?: ChatEmiID;
  forwardedFromMessageId?: ChatEmiID;
  forwardedAt?: string;
  forwardCount?: number;
  reactions?: ChatEmiReaction[];
  status?: ChatEmiMessageStatus;
  deliveredTo?: ChatEmiReceiptEvent[];
  readBy?: ChatEmiReceiptEvent[];
  viewCount?: number;
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
  members?: ChatEmiMember[];
  ownerId?: ChatEmiID;
  adminIds?: ChatEmiID[];
  inviteLink?: string;
  publicUsername?: string;
  lastMessage?: ChatEmiMessage;
  unreadCount?: number;
  mutedUntil?: string | null;
  pinned?: boolean;
  archived?: boolean;
  readOnly?: boolean;
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
  kind?: ChatEmiMessageKind;
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
  publicUsername?: string;
  readOnly?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiForwardMessageInput {
  sourceConversationId: ChatEmiID;
  targetConversationId: ChatEmiID;
  messageId: ChatEmiID;
  comment?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatEmiManageMemberInput {
  conversationId: ChatEmiID;
  userId: ChatEmiID;
}

export interface ChatEmiUpdateMemberInput extends ChatEmiManageMemberInput {
  role?: ChatEmiMemberRole;
  permissions?: ChatEmiMemberPermission[];
  mutedUntil?: string | null;
  bannedUntil?: string | null;
  title?: string;
}

export interface ChatEmiUpdateAvatarInput {
  conversationId?: ChatEmiID;
  userId?: ChatEmiID;
  attachment: ChatEmiAttachment;
}

export interface ChatEmiUserSearchOptions extends ChatEmiListOptions {
  query: string;
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
  "conversation.member.added": { conversationId: ChatEmiID; member: ChatEmiMember };
  "conversation.member.updated": { conversationId: ChatEmiID; member: ChatEmiMember };
  "conversation.member.removed": { conversationId: ChatEmiID; userId: ChatEmiID };
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
  users?: string;
  user?: (userId: ChatEmiID) => string;
  conversations?: string;
  conversation?: (conversationId: ChatEmiID) => string;
  conversationAvatar?: (conversationId: ChatEmiID) => string;
  members?: (conversationId: ChatEmiID) => string;
  member?: (conversationId: ChatEmiID, userId: ChatEmiID) => string;
  messages?: (conversationId: ChatEmiID) => string;
  message?: (conversationId: ChatEmiID, messageId: ChatEmiID) => string;
  markRead?: (conversationId: ChatEmiID) => string;
  markDelivered?: (conversationId: ChatEmiID) => string;
  forwardMessage?: (conversationId: ChatEmiID, messageId: ChatEmiID) => string;
  reactions?: (conversationId: ChatEmiID, messageId: ChatEmiID) => string;
  upload?: string;
  search?: string;
}

export interface ChatEmiUserDirectoryConfig {
  baseUrl: string;
  searchPath?: string;
  userPath?: (userId: ChatEmiID) => string;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  mapUser?: (rawUser: unknown) => ChatEmiUser;
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
  userDirectory?: ChatEmiUserDirectoryConfig;
  theme?: ChatEmiTheme;
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
  theme: ChatEmiTheme;
  loading: boolean;
  error?: string;
}

export interface ChatEmiMessengerProps {
  className?: string;
  emptyState?: ReactNode;
  composerPlaceholder?: string;
  showSidebar?: boolean;
  theme?: ChatEmiTheme;
  enableAdminControls?: boolean;
  enableMessageActions?: boolean;
  enableMediaPreview?: boolean;
  renderConversation?: (conversation: ChatEmiConversation, isActive: boolean) => ReactNode;
  renderMessage?: (message: ChatEmiMessage, isMine: boolean) => ReactNode;
}
