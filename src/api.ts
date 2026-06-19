import type {
  ChatEmiAttachment,
  ChatEmiConfig,
  ChatEmiConversation,
  ChatEmiCreateConversationInput,
  ChatEmiEditMessageInput,
  ChatEmiForwardMessageInput,
  ChatEmiID,
  ChatEmiListOptions,
  ChatEmiManageMemberInput,
  ChatEmiMember,
  ChatEmiMessage,
  ChatEmiMessageListOptions,
  ChatEmiPage,
  ChatEmiSendMessageInput,
  ChatEmiUpdateAvatarInput,
  ChatEmiUpdateMemberInput,
  ChatEmiUploadAttachmentInput,
  ChatEmiUser,
  ChatEmiUserSearchOptions
} from "./types";

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: RequestMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  headers?: HeadersInit;
  baseUrl?: string;
  authorize?: boolean;
}

const defaultEndpoints = {
  me: "/me",
  users: "/users",
  user: (userId: ChatEmiID) => `/users/${encodeURIComponent(userId)}`,
  conversations: "/conversations",
  conversation: (conversationId: ChatEmiID) => `/conversations/${encodeURIComponent(conversationId)}`,
  conversationAvatar: (conversationId: ChatEmiID) => `/conversations/${encodeURIComponent(conversationId)}/avatar`,
  members: (conversationId: ChatEmiID) => `/conversations/${encodeURIComponent(conversationId)}/members`,
  member: (conversationId: ChatEmiID, userId: ChatEmiID) =>
    `/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`,
  messages: (conversationId: ChatEmiID) => `/conversations/${encodeURIComponent(conversationId)}/messages`,
  message: (conversationId: ChatEmiID, messageId: ChatEmiID) =>
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
  markRead: (conversationId: ChatEmiID) => `/conversations/${encodeURIComponent(conversationId)}/read`,
  markDelivered: (conversationId: ChatEmiID) => `/conversations/${encodeURIComponent(conversationId)}/delivered`,
  forwardMessage: (conversationId: ChatEmiID, messageId: ChatEmiID) =>
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/forward`,
  reactions: (conversationId: ChatEmiID, messageId: ChatEmiID) =>
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reactions`,
  upload: "/attachments",
  search: "/search/messages"
};

export class ChatEmiApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ChatEmiApiError";
    this.status = status;
    this.payload = payload;
  }
}

export class ChatEmiApi {
  private readonly config: ChatEmiConfig;
  private readonly fetcher: typeof fetch;

  constructor(config: ChatEmiConfig) {
    this.config = config;
    this.fetcher = config.fetchImpl ?? fetch;
  }

  async getMe(signal?: AbortSignal): Promise<ChatEmiUser> {
    return this.request<ChatEmiUser>(this.endpoint("me"), { signal });
  }

  async searchUsers(options: ChatEmiUserSearchOptions, signal?: AbortSignal): Promise<ChatEmiPage<ChatEmiUser>> {
    if (this.config.userDirectory) {
      const path = this.config.userDirectory.searchPath ?? "/users";
      const payload = await this.request<ChatEmiPage<ChatEmiUser> | ChatEmiUser[]>(path, {
        query: { q: options.query, cursor: options.cursor, limit: options.limit },
        signal,
        baseUrl: this.config.userDirectory.baseUrl,
        headers: await this.resolveUserDirectoryHeaders(),
        authorize: false
      });

      return normalizeUserPage(payload, this.config.userDirectory.mapUser);
    }

    return this.request<ChatEmiPage<ChatEmiUser>>(this.endpoint("users"), {
      query: { q: options.query, cursor: options.cursor, limit: options.limit },
      signal
    });
  }

  async getUser(userId: ChatEmiID, signal?: AbortSignal): Promise<ChatEmiUser> {
    if (this.config.userDirectory) {
      const path = this.config.userDirectory.userPath?.(userId) ?? `/users/${encodeURIComponent(userId)}`;
      const payload = await this.request<ChatEmiUser>(path, {
        signal,
        baseUrl: this.config.userDirectory.baseUrl,
        headers: await this.resolveUserDirectoryHeaders(),
        authorize: false
      });

      return this.config.userDirectory.mapUser ? this.config.userDirectory.mapUser(payload) : payload;
    }

    return this.request<ChatEmiUser>(this.endpoint("user", userId), { signal });
  }

  async listConversations(options: ChatEmiListOptions = {}, signal?: AbortSignal): Promise<ChatEmiPage<ChatEmiConversation>> {
    return this.request<ChatEmiPage<ChatEmiConversation>>(this.endpoint("conversations"), {
      query: { ...options },
      signal
    });
  }

  async getConversation(conversationId: ChatEmiID, signal?: AbortSignal): Promise<ChatEmiConversation> {
    return this.request<ChatEmiConversation>(this.endpoint("conversation", conversationId), { signal });
  }

  async createConversation(input: ChatEmiCreateConversationInput): Promise<ChatEmiConversation> {
    return this.request<ChatEmiConversation>(this.endpoint("conversations"), {
      method: "POST",
      body: input
    });
  }

  async createGroup(input: Omit<ChatEmiCreateConversationInput, "type">): Promise<ChatEmiConversation> {
    return this.createConversation({ ...input, type: "group" });
  }

  async createChannel(input: Omit<ChatEmiCreateConversationInput, "type">): Promise<ChatEmiConversation> {
    return this.createConversation({ ...input, type: "channel", readOnly: input.readOnly ?? true });
  }

  async updateConversation(conversationId: ChatEmiID, input: Partial<ChatEmiConversation>): Promise<ChatEmiConversation> {
    return this.request<ChatEmiConversation>(this.endpoint("conversation", conversationId), {
      method: "PATCH",
      body: input
    });
  }

  async archiveConversation(conversationId: ChatEmiID): Promise<void> {
    await this.request<void>(this.endpoint("conversation", conversationId), {
      method: "DELETE"
    });
  }

  async updateConversationAvatar(input: ChatEmiUpdateAvatarInput): Promise<ChatEmiConversation | ChatEmiUser> {
    if (input.conversationId) {
      return this.request<ChatEmiConversation>(this.endpoint("conversationAvatar", input.conversationId), {
        method: "PATCH",
        body: { attachment: input.attachment }
      });
    }

    if (!input.userId) {
      throw new Error("ChatEmi avatar update requires conversationId or userId");
    }

    return this.request<ChatEmiUser>(this.endpoint("user", input.userId), {
      method: "PATCH",
      body: { avatar: input.attachment }
    });
  }

  async addMembers(conversationId: ChatEmiID, userIds: ChatEmiID[]): Promise<ChatEmiMember[]> {
    return this.request<ChatEmiMember[]>(this.endpoint("members", conversationId), {
      method: "POST",
      body: { userIds }
    });
  }

  async updateMember(input: ChatEmiUpdateMemberInput): Promise<ChatEmiMember> {
    return this.request<ChatEmiMember>(this.endpoint("member", input.conversationId, input.userId), {
      method: "PATCH",
      body: input
    });
  }

  async removeMember(input: ChatEmiManageMemberInput): Promise<void> {
    await this.request<void>(this.endpoint("member", input.conversationId, input.userId), {
      method: "DELETE"
    });
  }

  async listMessages(
    conversationId: ChatEmiID,
    options: ChatEmiMessageListOptions = {},
    signal?: AbortSignal
  ): Promise<ChatEmiPage<ChatEmiMessage>> {
    return this.request<ChatEmiPage<ChatEmiMessage>>(this.endpoint("messages", conversationId), {
      query: { ...options },
      signal
    });
  }

  async sendMessage(input: ChatEmiSendMessageInput): Promise<ChatEmiMessage> {
    return this.request<ChatEmiMessage>(this.endpoint("messages", input.conversationId), {
      method: "POST",
      body: input
    });
  }

  async forwardMessage(input: ChatEmiForwardMessageInput): Promise<ChatEmiMessage> {
    return this.request<ChatEmiMessage>(this.endpoint("forwardMessage", input.sourceConversationId, input.messageId), {
      method: "POST",
      body: input
    });
  }

  async editMessage(input: ChatEmiEditMessageInput): Promise<ChatEmiMessage> {
    return this.request<ChatEmiMessage>(this.endpoint("message", input.conversationId, input.messageId), {
      method: "PATCH",
      body: input
    });
  }

  async deleteMessage(conversationId: ChatEmiID, messageId: ChatEmiID): Promise<void> {
    await this.request<void>(this.endpoint("message", conversationId, messageId), {
      method: "DELETE"
    });
  }

  async markConversationRead(conversationId: ChatEmiID, messageIds?: ChatEmiID[]): Promise<void> {
    await this.request<void>(this.endpoint("markRead", conversationId), {
      method: "POST",
      body: { messageIds }
    });
  }

  async markConversationDelivered(conversationId: ChatEmiID, messageIds?: ChatEmiID[]): Promise<void> {
    await this.request<void>(this.endpoint("markDelivered", conversationId), {
      method: "POST",
      body: { messageIds }
    });
  }

  async addReaction(conversationId: ChatEmiID, messageId: ChatEmiID, emoji: string): Promise<ChatEmiMessage> {
    return this.request<ChatEmiMessage>(this.endpoint("reactions", conversationId, messageId), {
      method: "POST",
      body: { emoji }
    });
  }

  async removeReaction(conversationId: ChatEmiID, messageId: ChatEmiID, emoji: string): Promise<ChatEmiMessage> {
    return this.request<ChatEmiMessage>(this.endpoint("reactions", conversationId, messageId), {
      method: "DELETE",
      body: { emoji }
    });
  }

  async uploadAttachment(input: ChatEmiUploadAttachmentInput): Promise<ChatEmiAttachment> {
    const formData = new FormData();
    formData.append("file", input.file, input.name);

    if (input.conversationId) formData.append("conversationId", input.conversationId);
    if (input.type) formData.append("type", input.type);
    if (input.metadata) formData.append("metadata", JSON.stringify(input.metadata));

    return this.request<ChatEmiAttachment>(this.endpoint("upload"), {
      method: "POST",
      body: formData
    });
  }

  async searchMessages(query: string, options: ChatEmiListOptions = {}, signal?: AbortSignal): Promise<ChatEmiPage<ChatEmiMessage>> {
    return this.request<ChatEmiPage<ChatEmiMessage>>(this.endpoint("search"), {
      query: { q: query, ...options },
      signal
    });
  }

  private endpoint(name: "me" | "users" | "conversations" | "upload" | "search"): string;
  private endpoint(
    name: "user" | "conversation" | "conversationAvatar" | "members" | "messages" | "markRead" | "markDelivered",
    conversationId: ChatEmiID
  ): string;
  private endpoint(name: "member" | "message" | "forwardMessage" | "reactions", conversationId: ChatEmiID, messageId: ChatEmiID): string;
  private endpoint(name: keyof typeof defaultEndpoints, conversationId?: ChatEmiID, messageId?: ChatEmiID): string {
    switch (name) {
      case "user":
      case "conversation":
      case "conversationAvatar":
      case "members":
      case "messages":
      case "markRead":
      case "markDelivered":
        return (this.config.endpoints?.[name] ?? defaultEndpoints[name])(conversationId ?? "");
      case "member":
      case "message":
      case "forwardMessage":
      case "reactions":
        return (this.config.endpoints?.[name] ?? defaultEndpoints[name])(conversationId ?? "", messageId ?? "");
      default:
        return this.config.endpoints?.[name] ?? defaultEndpoints[name];
    }
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query, options.baseUrl);
    const headers = new Headers(await this.resolveHeaders(options.headers, options.authorize ?? true));
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

    if (!isFormData && options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.fetcher(url, {
      method: options.method ?? "GET",
      headers,
      body: isFormData ? (options.body as BodyInit) : options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = await this.parseResponse(response);

    if (!response.ok) {
      throw new ChatEmiApiError(this.errorMessage(payload, response.status), response.status, payload);
    }

    return payload as T;
  }

  private buildUrl(path: string, query?: RequestOptions["query"], baseUrl = this.config.apiBaseUrl): string {
    const absolute = /^https?:\/\//i.test(path);
    const base = baseUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(absolute ? path : `${base}${normalizedPath}`);

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  private async resolveHeaders(extraHeaders?: HeadersInit, authorize = true): Promise<HeadersInit> {
    const headers = new Headers();
    const configuredHeaders = typeof this.config.headers === "function" ? await this.config.headers() : this.config.headers;
    const token = typeof this.config.token === "function" ? await this.config.token() : this.config.token;

    new Headers(configuredHeaders).forEach((value, key) => headers.set(key, value));
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));

    if (authorize && token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return headers;
  }

  private async resolveUserDirectoryHeaders(): Promise<HeadersInit> {
    const configuredHeaders =
      typeof this.config.userDirectory?.headers === "function"
        ? await this.config.userDirectory.headers()
        : this.config.userDirectory?.headers;

    return configuredHeaders ?? {};
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get("Content-Type") ?? "";

    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  }

  private errorMessage(payload: unknown, status: number): string {
    if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
      return payload.message;
    }

    return `ChatEmi API request failed with status ${status}`;
  }
}

function normalizeUserPage(payload: ChatEmiPage<ChatEmiUser> | ChatEmiUser[], mapUser?: (rawUser: unknown) => ChatEmiUser): ChatEmiPage<ChatEmiUser> {
  const normalize = (user: unknown) => (mapUser ? mapUser(user) : (user as ChatEmiUser));

  if (Array.isArray(payload)) {
    return {
      items: payload.map(normalize)
    };
  }

  return {
    ...payload,
    items: payload.items.map(normalize)
  };
}
