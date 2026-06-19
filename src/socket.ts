import type {
  ChatEmiConfig,
  ChatEmiID,
  ChatEmiPresenceStatus,
  ChatEmiSocketEnvelope,
  ChatEmiSocketEventMap,
  ChatEmiSocketEventName,
  ChatEmiSocketHandler
} from "./types";

type AnyHandler = (payload: unknown) => void;

const DEFAULT_INITIAL_DELAY = 500;
const DEFAULT_MAX_DELAY = 8000;
const DEFAULT_MAX_ATTEMPTS = Number.POSITIVE_INFINITY;

export class ChatEmiSocket {
  private readonly config: ChatEmiConfig;
  private socket?: WebSocket;
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private readonly queue: ChatEmiSocketEnvelope[] = [];
  private readonly listeners = new Map<ChatEmiSocketEventName, Set<AnyHandler>>();

  constructor(config: ChatEmiConfig) {
    this.config = config;
  }

  get readyState(): number | undefined {
    return this.socket?.readyState;
  }

  async connect(): Promise<void> {
    if (!this.config.socketUrl) return;

    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.shouldReconnect = this.config.reconnect?.enabled ?? true;
    this.createSocket(await this.buildSocketUrl());
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = undefined;
  }

  on<TName extends ChatEmiSocketEventName>(eventName: TName, handler: ChatEmiSocketHandler<TName>): () => void {
    const handlers = this.listeners.get(eventName) ?? new Set<AnyHandler>();
    handlers.add(handler as AnyHandler);
    this.listeners.set(eventName, handlers);

    return () => {
      handlers.delete(handler as AnyHandler);
      if (handlers.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  send<TPayload>(type: string, payload: TPayload, requestId?: string): void {
    const envelope: ChatEmiSocketEnvelope<string, TPayload> = { type, payload, requestId };

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(envelope));
      return;
    }

    this.queue.push(envelope);
  }

  subscribeConversation(conversationId: ChatEmiID): void {
    this.send("conversation.subscribe", { conversationId });
  }

  unsubscribeConversation(conversationId: ChatEmiID): void {
    this.send("conversation.unsubscribe", { conversationId });
  }

  sendTyping(conversationId: ChatEmiID, isTyping: boolean): void {
    this.send("typing", { conversationId, isTyping });
  }

  sendReadReceipt(conversationId: ChatEmiID, messageIds: ChatEmiID[]): void {
    this.send("message.read", { conversationId, messageIds });
  }

  sendPresence(status: ChatEmiPresenceStatus): void {
    this.send("presence", { status });
  }

  private createSocket(url: string): void {
    const factory = this.config.websocketFactory ?? ((socketUrl: string) => new WebSocket(socketUrl));
    const socket = factory(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.dispatch("connected", undefined);
      this.flushQueue();
    });

    socket.addEventListener("close", (event) => {
      this.dispatch("disconnected", event);
      this.socket = undefined;
      this.scheduleReconnect();
    });

    socket.addEventListener("error", (event) => {
      this.dispatch("error", event);
    });

    socket.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });
  }

  private handleMessage(data: unknown): void {
    try {
      const envelope = typeof data === "string" ? (JSON.parse(data) as ChatEmiSocketEnvelope) : (data as ChatEmiSocketEnvelope);

      if (envelope && typeof envelope.type === "string") {
        this.dispatch(envelope.type as ChatEmiSocketEventName, envelope.payload);
      }
    } catch (error) {
      this.dispatch("error", error instanceof Error ? error : new Error("Unable to parse ChatEmi socket message"));
    }
  }

  private flushQueue(): void {
    while (this.queue.length > 0 && this.socket?.readyState === WebSocket.OPEN) {
      const envelope = this.queue.shift();
      if (envelope) {
        this.socket.send(JSON.stringify(envelope));
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || !this.config.socketUrl) return;

    const maxAttempts = this.config.reconnect?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    if (this.reconnectAttempts >= maxAttempts) return;

    this.reconnectAttempts += 1;

    const initialDelay = this.config.reconnect?.initialDelayMs ?? DEFAULT_INITIAL_DELAY;
    const maxDelay = this.config.reconnect?.maxDelayMs ?? DEFAULT_MAX_DELAY;
    const delay = Math.min(initialDelay * 2 ** (this.reconnectAttempts - 1), maxDelay);

    this.dispatch("reconnecting", { attempt: this.reconnectAttempts, delay });
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay);
  }

  private async buildSocketUrl(): Promise<string> {
    const rawUrl = this.config.socketUrl;
    if (!rawUrl) {
      throw new Error("ChatEmi socketUrl is required before connecting the socket");
    }

    const url = new URL(rawUrl);
    const token = typeof this.config.token === "function" ? await this.config.token() : this.config.token;

    if (token) {
      url.searchParams.set("token", token);
    }

    return url.toString();
  }

  private dispatch<TName extends ChatEmiSocketEventName>(eventName: TName, payload: ChatEmiSocketEventMap[TName]): void {
    this.listeners.get(eventName)?.forEach((handler) => handler(payload));
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
