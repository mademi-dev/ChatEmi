import { FormEvent, ReactElement, useMemo, useRef, useState } from "react";
import { useChatEmi } from "../context";
import type { ChatEmiAttachment, ChatEmiConversation, ChatEmiMessage, ChatEmiMessengerProps } from "../types";

export function ChatEmiMessenger({
  className,
  emptyState,
  composerPlaceholder = "Write a message...",
  showSidebar = true,
  renderConversation,
  renderMessage
}: ChatEmiMessengerProps): ReactElement {
  const {
    actions,
    activeConversation,
    activeMessages,
    connectionStatus,
    conversations,
    currentUser,
    error,
    loading,
    typingByConversation
  } = useChatEmi();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [attachments, setAttachments] = useState<ChatEmiAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return conversations;

    return conversations.filter((conversation) => conversationTitle(conversation, currentUser?.id).toLowerCase().includes(normalizedSearch));
  }, [conversations, currentUser?.id, search]);

  const typingUsers = activeConversation ? typingByConversation[activeConversation.id] ?? [] : [];

  async function handleSend(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!activeConversation || (!draft.trim() && attachments.length === 0)) return;

    const text = draft.trim();
    const currentAttachments = attachments;

    setDraft("");
    setAttachments([]);
    actions.stopTyping(activeConversation.id);

    try {
      await actions.sendMessage({
        conversationId: activeConversation.id,
        text: text || undefined,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined
      });
    } catch {
      setDraft(text);
      setAttachments(currentAttachments);
    }
  }

  async function handleFileChange(files: FileList | null): Promise<void> {
    if (!files?.length) return;

    setUploading(true);

    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => actions.uploadAttachment({ file, name: file.name })));
      setAttachments((currentAttachments) => [...currentAttachments, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  function handleDraftChange(value: string): void {
    setDraft(value);

    if (!activeConversation) return;

    actions.startTyping(activeConversation.id);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => actions.stopTyping(activeConversation.id), 1400);
  }

  return (
    <section className={["chatemi", className].filter(Boolean).join(" ")} data-status={connectionStatus}>
      {showSidebar ? (
        <aside className="chatemi__sidebar" aria-label="Conversations">
          <div className="chatemi__brand">
            <div>
              <strong>ChatEmi</strong>
              <span>{connectionLabel(connectionStatus)}</span>
            </div>
            <span className={`chatemi__status chatemi__status--${connectionStatus}`} />
          </div>

          <label className="chatemi__search">
            <span className="chatemi__sr-only">Search conversations</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" />
          </label>

          <div className="chatemi__conversation-list">
            {filteredConversations.map((conversation) => {
              const isActive = conversation.id === activeConversation?.id;

              return (
                <button
                  className={`chatemi__conversation ${isActive ? "chatemi__conversation--active" : ""}`}
                  key={conversation.id}
                  onClick={() => void actions.openConversation(conversation.id)}
                  type="button"
                >
                  {renderConversation ? renderConversation(conversation, isActive) : <DefaultConversation conversation={conversation} currentUserId={currentUser?.id} />}
                </button>
              );
            })}
          </div>
        </aside>
      ) : null}

      <main className="chatemi__main">
        {activeConversation ? (
          <>
            <header className="chatemi__header">
              <Avatar conversation={activeConversation} currentUserId={currentUser?.id} />
              <div>
                <strong>{conversationTitle(activeConversation, currentUser?.id)}</strong>
                <span>{typingUsers.length > 0 ? `${typingUsers.map((event) => event.user.name).join(", ")} typing...` : memberLabel(activeConversation)}</span>
              </div>
            </header>

            <div className="chatemi__messages" role="log" aria-live="polite">
              {activeMessages.map((message) => {
                const isMine = message.sender.id === currentUser?.id;

                return renderMessage ? (
                  <div className="chatemi__message-shell" key={message.id}>
                    {renderMessage(message, isMine)}
                  </div>
                ) : (
                  <DefaultMessage isMine={isMine} key={message.id} message={message} />
                );
              })}

              {activeMessages.length === 0 && !loading ? <div className="chatemi__empty">No messages yet. Start the conversation.</div> : null}
            </div>

            {attachments.length > 0 ? (
              <div className="chatemi__attachments">
                {attachments.map((attachment) => (
                  <button
                    className="chatemi__attachment-pill"
                    key={attachment.id}
                    onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                    type="button"
                  >
                    {attachment.name ?? attachment.type}
                  </button>
                ))}
              </div>
            ) : null}

            <form className="chatemi__composer" onSubmit={(event) => void handleSend(event)}>
              <label className="chatemi__upload">
                <span>{uploading ? "Uploading" : "Attach"}</span>
                <input disabled={uploading} multiple onChange={(event) => void handleFileChange(event.target.files)} type="file" />
              </label>
              <textarea
                onBlur={() => actions.stopTyping(activeConversation.id)}
                onChange={(event) => handleDraftChange(event.target.value)}
                placeholder={composerPlaceholder}
                rows={1}
                value={draft}
              />
              <button disabled={uploading || (!draft.trim() && attachments.length === 0)} type="submit">
                Send
              </button>
            </form>
          </>
        ) : (
          emptyState ?? <div className="chatemi__empty chatemi__empty--screen">Select a conversation to start messaging.</div>
        )}

        {error ? <div className="chatemi__error">{error}</div> : null}
      </main>
    </section>
  );
}

function DefaultConversation({ conversation, currentUserId }: { conversation: ChatEmiConversation; currentUserId?: string }): ReactElement {
  return (
    <>
      <Avatar conversation={conversation} currentUserId={currentUserId} />
      <span className="chatemi__conversation-body">
        <strong>{conversationTitle(conversation, currentUserId)}</strong>
        <small>{conversation.lastMessage?.text ?? conversation.description ?? "No messages yet"}</small>
      </span>
      {conversation.unreadCount ? <span className="chatemi__badge">{conversation.unreadCount}</span> : null}
    </>
  );
}

function DefaultMessage({ message, isMine }: { message: ChatEmiMessage; isMine: boolean }): ReactElement {
  return (
    <article className={`chatemi__message ${isMine ? "chatemi__message--mine" : ""}`}>
      {!isMine ? <strong className="chatemi__message-sender">{message.sender.name}</strong> : null}
      {message.text ? <p>{message.text}</p> : null}
      {message.html ? <div className="chatemi__message-html" dangerouslySetInnerHTML={{ __html: message.html }} /> : null}
      {message.attachments?.length ? (
        <div className="chatemi__message-attachments">
          {message.attachments.map((attachment) => (
            <a href={attachment.url} key={attachment.id} rel="noreferrer" target="_blank">
              {attachment.thumbnailUrl ? <img alt={attachment.name ?? attachment.type} src={attachment.thumbnailUrl} /> : null}
              <span>{attachment.name ?? attachment.type}</span>
            </a>
          ))}
        </div>
      ) : null}
      {message.reactions?.length ? (
        <div className="chatemi__reactions">
          {message.reactions.map((reaction) => (
            <span key={reaction.emoji}>
              {reaction.emoji} {reaction.count}
            </span>
          ))}
        </div>
      ) : null}
      <footer>
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        {isMine && message.status ? <span>{message.status}</span> : null}
      </footer>
    </article>
  );
}

function Avatar({ conversation, currentUserId }: { conversation: ChatEmiConversation; currentUserId?: string }): ReactElement {
  const title = conversationTitle(conversation, currentUserId);
  const participant = conversation.participants.find((user) => user.id !== currentUserId) ?? conversation.participants[0];
  const avatarUrl = conversation.avatarUrl ?? participant?.avatarUrl;

  return avatarUrl ? (
    <img alt="" className="chatemi__avatar" src={avatarUrl} />
  ) : (
    <span className="chatemi__avatar chatemi__avatar--fallback">{title.slice(0, 2).toUpperCase()}</span>
  );
}

function conversationTitle(conversation: ChatEmiConversation, currentUserId?: string): string {
  if (conversation.title) return conversation.title;

  const participants = conversation.participants.filter((participant) => participant.id !== currentUserId);
  return participants.map((participant) => participant.name).join(", ") || "Untitled chat";
}

function memberLabel(conversation: ChatEmiConversation): string {
  const count = conversation.participants.length;
  return `${count} ${count === 1 ? "member" : "members"}`;
}

function connectionLabel(status: string): string {
  switch (status) {
    case "connected":
      return "Realtime online";
    case "connecting":
    case "reconnecting":
      return "Connecting";
    case "error":
      return "Connection issue";
    default:
      return "Realtime idle";
  }
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
