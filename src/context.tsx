import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import { ChatEmiApi } from "./api";
import { ChatEmiSocket } from "./socket";
import type {
  ChatEmiAttachment,
  ChatEmiConfig,
  ChatEmiConnectionStatus,
  ChatEmiConversation,
  ChatEmiCreateConversationInput,
  ChatEmiEditMessageInput,
  ChatEmiID,
  ChatEmiListOptions,
  ChatEmiMessage,
  ChatEmiMessageListOptions,
  ChatEmiPresenceStatus,
  ChatEmiProviderProps,
  ChatEmiSendMessageInput,
  ChatEmiState,
  ChatEmiTypingEvent,
  ChatEmiUploadAttachmentInput
} from "./types";

type ChatEmiAction =
  | { type: "set-loading"; loading: boolean }
  | { type: "set-error"; error?: string }
  | { type: "set-connection-status"; status: ChatEmiConnectionStatus }
  | { type: "set-current-user"; user?: ChatEmiState["currentUser"] }
  | { type: "set-conversations"; conversations: ChatEmiConversation[] }
  | { type: "upsert-conversation"; conversation: ChatEmiConversation }
  | { type: "remove-conversation"; conversationId: ChatEmiID }
  | { type: "set-active-conversation"; conversationId?: ChatEmiID }
  | { type: "set-messages"; conversationId: ChatEmiID; messages: ChatEmiMessage[] }
  | { type: "upsert-message"; message: ChatEmiMessage }
  | { type: "remove-message"; conversationId: ChatEmiID; messageId: ChatEmiID }
  | { type: "set-message-reactions"; conversationId: ChatEmiID; messageId: ChatEmiID; reactions: ChatEmiMessage["reactions"] }
  | { type: "set-typing"; event: ChatEmiTypingEvent }
  | { type: "set-presence"; userId: ChatEmiID; status: ChatEmiPresenceStatus; lastSeenAt?: string };

export interface ChatEmiActions {
  refreshConversations: (options?: ChatEmiListOptions) => Promise<ChatEmiConversation[]>;
  openConversation: (conversationId: ChatEmiID, options?: ChatEmiMessageListOptions) => Promise<ChatEmiMessage[]>;
  createConversation: (input: ChatEmiCreateConversationInput) => Promise<ChatEmiConversation>;
  sendMessage: (input: ChatEmiSendMessageInput) => Promise<ChatEmiMessage>;
  editMessage: (input: ChatEmiEditMessageInput) => Promise<ChatEmiMessage>;
  deleteMessage: (conversationId: ChatEmiID, messageId: ChatEmiID) => Promise<void>;
  markRead: (conversationId: ChatEmiID, messageIds?: ChatEmiID[]) => Promise<void>;
  addReaction: (conversationId: ChatEmiID, messageId: ChatEmiID, emoji: string) => Promise<ChatEmiMessage>;
  removeReaction: (conversationId: ChatEmiID, messageId: ChatEmiID, emoji: string) => Promise<ChatEmiMessage>;
  uploadAttachment: (input: ChatEmiUploadAttachmentInput) => Promise<ChatEmiAttachment>;
  searchMessages: (query: string, options?: ChatEmiListOptions) => Promise<ChatEmiMessage[]>;
  startTyping: (conversationId: ChatEmiID) => void;
  stopTyping: (conversationId: ChatEmiID) => void;
  setPresence: (status: ChatEmiPresenceStatus) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export interface ChatEmiContextValue extends ChatEmiState {
  api: ChatEmiApi;
  socket: ChatEmiSocket;
  activeConversation?: ChatEmiConversation;
  activeMessages: ChatEmiMessage[];
  actions: ChatEmiActions;
}

const ChatEmiContext = createContext<ChatEmiContextValue | undefined>(undefined);

function createInitialState(
  config: ChatEmiConfig,
  initialConversations: ChatEmiConversation[] = [],
  activeConversationId?: ChatEmiID
): ChatEmiState {
  return {
    currentUser: config.currentUser,
    conversations: initialConversations,
    activeConversationId: activeConversationId ?? initialConversations[0]?.id,
    messagesByConversation: {},
    typingByConversation: {},
    presenceByUser: {},
    connectionStatus: "idle",
    loading: false
  };
}

function reducer(state: ChatEmiState, action: ChatEmiAction): ChatEmiState {
  switch (action.type) {
    case "set-loading":
      return { ...state, loading: action.loading };
    case "set-error":
      return { ...state, error: action.error };
    case "set-connection-status":
      return { ...state, connectionStatus: action.status };
    case "set-current-user":
      return { ...state, currentUser: action.user };
    case "set-conversations":
      return {
        ...state,
        conversations: sortConversations(action.conversations),
        activeConversationId: state.activeConversationId ?? action.conversations[0]?.id
      };
    case "upsert-conversation":
      return {
        ...state,
        conversations: sortConversations(upsertById(state.conversations, action.conversation))
      };
    case "remove-conversation":
      return {
        ...state,
        conversations: state.conversations.filter((conversation) => conversation.id !== action.conversationId),
        activeConversationId: state.activeConversationId === action.conversationId ? undefined : state.activeConversationId
      };
    case "set-active-conversation":
      return { ...state, activeConversationId: action.conversationId };
    case "set-messages":
      return {
        ...state,
        messagesByConversation: {
          ...state.messagesByConversation,
          [action.conversationId]: sortMessages(action.messages)
        }
      };
    case "upsert-message": {
      const messages = state.messagesByConversation[action.message.conversationId] ?? [];
      const conversations = touchConversationWithMessage(state.conversations, action.message);

      return {
        ...state,
        conversations,
        messagesByConversation: {
          ...state.messagesByConversation,
          [action.message.conversationId]: sortMessages(upsertById(messages, action.message))
        }
      };
    }
    case "remove-message":
      return {
        ...state,
        messagesByConversation: {
          ...state.messagesByConversation,
          [action.conversationId]: (state.messagesByConversation[action.conversationId] ?? []).filter(
            (message) => message.id !== action.messageId
          )
        }
      };
    case "set-message-reactions":
      return {
        ...state,
        messagesByConversation: {
          ...state.messagesByConversation,
          [action.conversationId]: (state.messagesByConversation[action.conversationId] ?? []).map((message) =>
            message.id === action.messageId ? { ...message, reactions: action.reactions } : message
          )
        }
      };
    case "set-typing": {
      const currentEvents = state.typingByConversation[action.event.conversationId] ?? [];
      const withoutUser = currentEvents.filter((event) => event.user.id !== action.event.user.id);

      return {
        ...state,
        typingByConversation: {
          ...state.typingByConversation,
          [action.event.conversationId]: action.event.isTyping ? [...withoutUser, action.event] : withoutUser
        }
      };
    }
    case "set-presence":
      return {
        ...state,
        presenceByUser: {
          ...state.presenceByUser,
          [action.userId]: {
            userId: action.userId,
            status: action.status,
            lastSeenAt: action.lastSeenAt
          }
        }
      };
    default:
      return state;
  }
}

export function ChatEmiProvider({
  children,
  config,
  autoConnect = true,
  initialConversations,
  initialActiveConversationId
}: ChatEmiProviderProps): JSX.Element {
  const api = useMemo(() => new ChatEmiApi(config), [config]);
  const socket = useMemo(() => new ChatEmiSocket(config), [config]);
  const [state, dispatch] = useReducer(
    reducer,
    createInitialState(config, initialConversations, initialActiveConversationId)
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    dispatch({ type: "set-current-user", user: config.currentUser });

    async function bootstrap(): Promise<void> {
      dispatch({ type: "set-loading", loading: true });
      dispatch({ type: "set-error", error: undefined });

      try {
        const [user, conversations] = await Promise.all([
          config.currentUser ? Promise.resolve(config.currentUser) : api.getMe(controller.signal).catch(() => undefined),
          api.listConversations({}, controller.signal)
        ]);

        if (!active) return;

        dispatch({ type: "set-current-user", user });
        dispatch({ type: "set-conversations", conversations: conversations.items });
      } catch (error) {
        if (active) {
          dispatch({ type: "set-error", error: getErrorMessage(error) });
        }
      } finally {
        if (active) {
          dispatch({ type: "set-loading", loading: false });
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
      controller.abort();
    };
  }, [api, config.currentUser]);

  useEffect(() => {
    const cleanups = [
      socket.on("connected", () => dispatch({ type: "set-connection-status", status: "connected" })),
      socket.on("disconnected", () => dispatch({ type: "set-connection-status", status: "disconnected" })),
      socket.on("reconnecting", () => dispatch({ type: "set-connection-status", status: "reconnecting" })),
      socket.on("error", (error) => {
        dispatch({ type: "set-connection-status", status: "error" });
        dispatch({ type: "set-error", error: getErrorMessage(error) });
      }),
      socket.on("conversation.created", (conversation) => dispatch({ type: "upsert-conversation", conversation })),
      socket.on("conversation.updated", (conversation) => dispatch({ type: "upsert-conversation", conversation })),
      socket.on("conversation.deleted", ({ conversationId }) => dispatch({ type: "remove-conversation", conversationId })),
      socket.on("message.created", (message) => dispatch({ type: "upsert-message", message })),
      socket.on("message.updated", (message) => dispatch({ type: "upsert-message", message })),
      socket.on("message.deleted", ({ conversationId, messageId }) => dispatch({ type: "remove-message", conversationId, messageId })),
      socket.on("message.reaction", ({ conversationId, messageId, reactions }) =>
        dispatch({ type: "set-message-reactions", conversationId, messageId, reactions })
      ),
      socket.on("typing", (event) => dispatch({ type: "set-typing", event })),
      socket.on("presence", ({ userId, status, lastSeenAt }) => dispatch({ type: "set-presence", userId, status, lastSeenAt }))
    ];

    if (autoConnect && config.socketUrl) {
      dispatch({ type: "set-connection-status", status: "connecting" });
      void socket.connect();
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      socket.disconnect();
    };
  }, [autoConnect, config.socketUrl, socket]);

  const refreshConversations = useCallback(
    async (options: ChatEmiListOptions = {}) => {
      dispatch({ type: "set-loading", loading: true });

      try {
        const page = await api.listConversations(options);
        dispatch({ type: "set-conversations", conversations: page.items });
        return page.items;
      } finally {
        dispatch({ type: "set-loading", loading: false });
      }
    },
    [api]
  );

  const openConversation = useCallback(
    async (conversationId: ChatEmiID, options: ChatEmiMessageListOptions = {}) => {
      dispatch({ type: "set-active-conversation", conversationId });
      socket.subscribeConversation(conversationId);

      const page = await api.listMessages(conversationId, options);
      dispatch({ type: "set-messages", conversationId, messages: page.items });
      return page.items;
    },
    [api, socket]
  );

  const createConversation = useCallback(
    async (input: ChatEmiCreateConversationInput) => {
      const conversation = await api.createConversation(input);
      dispatch({ type: "upsert-conversation", conversation });
      dispatch({ type: "set-active-conversation", conversationId: conversation.id });
      return conversation;
    },
    [api]
  );

  const sendMessage = useCallback(
    async (input: ChatEmiSendMessageInput) => {
      const temporaryId = `temp-${Date.now()}`;
      const optimisticMessage: ChatEmiMessage | undefined = state.currentUser
        ? {
            id: temporaryId,
            conversationId: input.conversationId,
            sender: state.currentUser,
            text: input.text,
            html: input.html,
            attachments: input.attachments,
            status: "sending",
            createdAt: new Date().toISOString(),
            metadata: input.metadata
          }
        : undefined;

      if (optimisticMessage) {
        dispatch({ type: "upsert-message", message: optimisticMessage });
      }

      try {
        const message = await api.sendMessage(input);
        if (optimisticMessage) {
          dispatch({ type: "remove-message", conversationId: input.conversationId, messageId: temporaryId });
        }
        dispatch({ type: "upsert-message", message });
        return message;
      } catch (error) {
        if (optimisticMessage) {
          dispatch({ type: "upsert-message", message: { ...optimisticMessage, status: "failed" } });
        }
        throw error;
      }
    },
    [api, state.currentUser]
  );

  const editMessage = useCallback(
    async (input: ChatEmiEditMessageInput) => {
      const message = await api.editMessage(input);
      dispatch({ type: "upsert-message", message });
      return message;
    },
    [api]
  );

  const deleteMessage = useCallback(
    async (conversationId: ChatEmiID, messageId: ChatEmiID) => {
      await api.deleteMessage(conversationId, messageId);
      dispatch({ type: "remove-message", conversationId, messageId });
    },
    [api]
  );

  const markRead = useCallback(
    async (conversationId: ChatEmiID, messageIds?: ChatEmiID[]) => {
      await api.markConversationRead(conversationId, messageIds);
      socket.sendReadReceipt(conversationId, messageIds ?? []);
    },
    [api, socket]
  );

  const addReaction = useCallback(
    async (conversationId: ChatEmiID, messageId: ChatEmiID, emoji: string) => {
      const message = await api.addReaction(conversationId, messageId, emoji);
      dispatch({ type: "upsert-message", message });
      return message;
    },
    [api]
  );

  const removeReaction = useCallback(
    async (conversationId: ChatEmiID, messageId: ChatEmiID, emoji: string) => {
      const message = await api.removeReaction(conversationId, messageId, emoji);
      dispatch({ type: "upsert-message", message });
      return message;
    },
    [api]
  );

  const uploadAttachment = useCallback((input: ChatEmiUploadAttachmentInput) => api.uploadAttachment(input), [api]);

  const searchMessages = useCallback(
    async (query: string, options: ChatEmiListOptions = {}) => {
      const page = await api.searchMessages(query, options);
      return page.items;
    },
    [api]
  );

  const startTyping = useCallback((conversationId: ChatEmiID) => socket.sendTyping(conversationId, true), [socket]);

  const stopTyping = useCallback((conversationId: ChatEmiID) => socket.sendTyping(conversationId, false), [socket]);

  const setPresence = useCallback((status: ChatEmiPresenceStatus) => socket.sendPresence(status), [socket]);

  const connect = useCallback(() => socket.connect(), [socket]);

  const disconnect = useCallback(() => socket.disconnect(), [socket]);

  const actions = useMemo<ChatEmiActions>(
    () => ({
      refreshConversations,
      openConversation,
      createConversation,
      sendMessage,
      editMessage,
      deleteMessage,
      markRead,
      addReaction,
      removeReaction,
      uploadAttachment,
      searchMessages,
      startTyping,
      stopTyping,
      setPresence,
      connect,
      disconnect
    }),
    [
      refreshConversations,
      openConversation,
      createConversation,
      sendMessage,
      editMessage,
      deleteMessage,
      markRead,
      addReaction,
      removeReaction,
      uploadAttachment,
      searchMessages,
      startTyping,
      stopTyping,
      setPresence,
      connect,
      disconnect
    ]
  );

  const activeConversation = state.conversations.find((conversation) => conversation.id === state.activeConversationId);
  const activeMessages = state.activeConversationId ? state.messagesByConversation[state.activeConversationId] ?? [] : [];

  const value = useMemo<ChatEmiContextValue>(
    () => ({
      ...state,
      api,
      socket,
      activeConversation,
      activeMessages,
      actions
    }),
    [actions, activeConversation, activeMessages, api, socket, state]
  );

  return <ChatEmiContext.Provider value={value}>{children}</ChatEmiContext.Provider>;
}

export function useChatEmi(): ChatEmiContextValue {
  const context = useContext(ChatEmiContext);

  if (!context) {
    throw new Error("useChatEmi must be used inside a ChatEmiProvider");
  }

  return context;
}

function upsertById<TItem extends { id: ChatEmiID }>(items: TItem[], item: TItem): TItem[] {
  const index = items.findIndex((currentItem) => currentItem.id === item.id);

  if (index === -1) {
    return [...items, item];
  }

  return [...items.slice(0, index), item, ...items.slice(index + 1)];
}

function sortConversations(conversations: ChatEmiConversation[]): ChatEmiConversation[] {
  return [...conversations].sort((left, right) => {
    const leftDate = left.lastMessage?.createdAt ?? left.updatedAt ?? left.createdAt;
    const rightDate = right.lastMessage?.createdAt ?? right.updatedAt ?? right.createdAt;
    return Date.parse(rightDate) - Date.parse(leftDate);
  });
}

function sortMessages(messages: ChatEmiMessage[]): ChatEmiMessage[] {
  return [...messages].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

function touchConversationWithMessage(conversations: ChatEmiConversation[], message: ChatEmiMessage): ChatEmiConversation[] {
  return sortConversations(
    conversations.map((conversation) =>
      conversation.id === message.conversationId
        ? {
            ...conversation,
            lastMessage: message,
            updatedAt: message.createdAt
          }
        : conversation
    )
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected ChatEmi error";
}
