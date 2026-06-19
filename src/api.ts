import type {
  ChatEmiAttachment,
  ChatEmiConfig,
  ChatEmiConversation,
  ChatEmiCreateConversationInput,
  ChatEmiEditMessageInput,
  ChatEmiID,
  ChatEmiListOptions,
  ChatEmiMessage,
  ChatEmiMessageListOptions,
  ChatEmiPage,
  ChatEmiSendMessageInput,
  ChatEmiUploadAttachmentInput,
  ChatEmiUser
} from "./types";

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: RequestMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

const defaultEndpoints = {
  me: "/me",
  conversations: "/conversations",
  conversation: (conversationId: ChatEmiID) => `/conversations/${encodeURIComponent(conversationId)}`,
  messages: (conversationId: ChatEmiID) => `/conversations/${encodeURIComponent(conversationId)}/messages`,
  message: (conversationId: ChatEmiID, messageId: ChatEmiID) =>
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
  markRead: (conversationId: ChatEmiID) => `/conversations/${encodeURIComponent(conversationId)}/read`,
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

  async listConversations(options: ChatEmiListOptions = {}, signal?: AbortSignal): Promise<ChatEmiPage<ChatEmiConversation>> {
    return this.request<ChatEmiPage<ChatEmiConversation>>(this.endpoint("conversations"), {
      query: options,
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

  async listMessages(
    conversationId: ChatEmiID,
    options: ChatEmiMessageListOptions = {},
    signal?: AbortSignal
  ): Promise<ChatEmiPage<ChatEmiMessage>> {
    return this.request<ChatEmiPage<ChatEmiMessage>>(this.endpoint("messages", conversationId), {
      query: options,
      signal
    });
  }

  async sendMessage(input: ChatEmiSendMessageInput): Promise<ChatEmiMessage> {
    return this.request<ChatEmiMessage>(this.endpoint("messages", input.conversationId), {
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

  private endpoint(name: "me" | "conversations" | "upload" | "search"): string;
  private endpoint(name: "conversation" | "messages" | "markRead", conversationId: ChatEmiID): string;
  private endpoint(name: "message" | "reactions", conversationId: ChatEmiID, messageId: ChatEmiID): string;
  private endpoint(name: keyof typeof defaultEndpoints, conversationId?: ChatEmiID, messageId?: ChatEmiID): string {
    const endpoint = this.config.endpoints?.[name] ?? defaultEndpoints[name];

    if (typeof endpoint === "function") {
      if (messageId) return endpoint(conversationId ?? "", messageId);
      return endpoint(conversationId ?? "");
    }

    return endpoint;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers = new Headers(await this.resolveHeaders(options.headers));
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

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const base = this.config.apiBaseUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${base}${normalizedPath}`);

    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    return url.toString();
  }

  private async resolveHeaders(extraHeaders?: HeadersInit): Promise<HeadersInit> {
    const headers = new Headers();
    const configuredHeaders = typeof this.config.headers === "function" ? await this.config.headers() : this.config.headers;
    const token = typeof this.config.token === "function" ? await this.config.token() : this.config.token;

    new Headers(configuredHeaders).forEach((value, key) => headers.set(key, value));
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));

    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return headers;
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
