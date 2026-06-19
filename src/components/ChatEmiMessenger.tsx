import { FormEvent, ReactElement, useEffect, useMemo, useRef, useState } from "react";
import { useChatEmi } from "../context";
import type { ChatEmiAttachment, ChatEmiConversation, ChatEmiMessage, ChatEmiMessengerProps, ChatEmiUser } from "../types";

export function ChatEmiMessenger({
  className,
  emptyState,
  composerPlaceholder = "Write a message...",
  showSidebar = true,
  theme,
  enableAdminControls = true,
  enableMessageActions = true,
  enableMediaPreview = true,
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
    theme: providerTheme,
    typingByConversation
  } = useChatEmi();
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [foundUsers, setFoundUsers] = useState<ChatEmiUser[]>([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatEmiMessage>();
  const [attachments, setAttachments] = useState<ChatEmiAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resolvedTheme = theme ?? providerTheme;

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return conversations;

    return conversations.filter((conversation) => conversationTitle(conversation, currentUser?.id).toLowerCase().includes(normalizedSearch));
  }, [conversations, currentUser?.id, search]);

  const typingUsers = activeConversation ? typingByConversation[activeConversation.id] ?? [] : [];
  const messageIds = useMemo(() => activeMessages.map((message) => message.id).join(","), [activeMessages]);
  const currentMember = activeConversation?.members?.find((member) => member.user.id === currentUser?.id);
  const canManageMembers = enableAdminControls && Boolean(currentMember && ["owner", "admin", "moderator"].includes(currentMember.role));

  useEffect(() => {
    if (!activeConversation || !messageIds) return;

    const unreadMessageIds = activeMessages.filter((message) => message.sender.id !== currentUser?.id).map((message) => message.id);
    if (unreadMessageIds.length > 0) {
      void actions.markRead(activeConversation.id, unreadMessageIds);
    }
  }, [actions, activeConversation, activeMessages, currentUser?.id, messageIds]);

  useEffect(() => {
    let active = true;

    async function searchUsers(): Promise<void> {
      if (userQuery.trim().length < 2) {
        setFoundUsers([]);
        return;
      }

      const users = await actions.searchUsers({ query: userQuery.trim(), limit: 8 });
      if (active) {
        setFoundUsers(users);
      }
    }

    void searchUsers();

    return () => {
      active = false;
    };
  }, [actions, userQuery]);

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
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        kind: messageKind(currentAttachments),
        replyToId: replyingTo?.id
      });
      setReplyingTo(undefined);
    } catch {
      setDraft(text);
      setAttachments(currentAttachments);
    }
  }

  async function handleFileChange(files: FileList | null): Promise<void> {
    if (!files?.length) return;

    setUploading(true);

    try {
      const uploaded = await Promise.all(
        Array.from(files).map((file) => actions.uploadAttachment({ file, name: file.name, type: attachmentType(file) }))
      );
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
    <section className={["chatemi", className].filter(Boolean).join(" ")} data-status={connectionStatus} data-theme={resolvedTheme}>
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
                <span>
                  {typingUsers.length > 0
                    ? `${typingUsers.map((event) => event.user.name).join(", ")} typing...`
                    : conversationStatus(activeConversation, currentUser?.id)}
                </span>
              </div>
              {canManageMembers ? (
                <button className="chatemi__header-action" onClick={() => setMembersOpen((open) => !open)} type="button">
                  Members
                </button>
              ) : null}
            </header>

            {membersOpen && activeConversation ? (
              <section className="chatemi__members" aria-label="Member management">
                <div className="chatemi__members-list">
                  {(activeConversation.members ?? activeConversation.participants.map((user) => fallbackMember(user))).map((member) => (
                    <div className="chatemi__member" key={member.user.id}>
                      {member.user.avatarUrl ? (
                        <img alt="" className="chatemi__member-avatar" src={member.user.avatarUrl} />
                      ) : (
                        <span className="chatemi__member-avatar">{member.user.name.slice(0, 2).toUpperCase()}</span>
                      )}
                      <span>
                        <strong>{member.user.name}</strong>
                        <small>{member.role}</small>
                      </span>
                      {member.role !== "owner" && member.user.id !== currentUser?.id ? (
                        <span className="chatemi__member-actions">
                          <button onClick={() => void actions.updateMember({ conversationId: activeConversation.id, userId: member.user.id, role: "admin" })} type="button">
                            Admin
                          </button>
                          <button onClick={() => void actions.updateMember({ conversationId: activeConversation.id, userId: member.user.id, role: "member" })} type="button">
                            Member
                          </button>
                          <button onClick={() => void actions.removeMember({ conversationId: activeConversation.id, userId: member.user.id })} type="button">
                            Remove
                          </button>
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
                <label className="chatemi__member-search">
                  <span>Find users from external directory</span>
                  <input onChange={(event) => setUserQuery(event.target.value)} placeholder="Search users" value={userQuery} />
                </label>
                {foundUsers.length > 0 ? (
                  <div className="chatemi__user-results">
                    {foundUsers.map((user) => (
                      <button key={user.id} onClick={() => void actions.addMembers(activeConversation.id, [user.id])} type="button">
                        {user.avatarUrl ? <img alt="" src={user.avatarUrl} /> : null}
                        Add {user.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="chatemi__messages" role="log" aria-live="polite">
              {activeMessages.map((message) => {
                const isMine = message.sender.id === currentUser?.id;

                return renderMessage ? (
                  <div className="chatemi__message-shell" key={message.id}>
                    {renderMessage(message, isMine)}
                  </div>
                ) : (
                  <DefaultMessage
                    enableActions={enableMessageActions}
                    enableMediaPreview={enableMediaPreview}
                    isMine={isMine}
                    key={message.id}
                    message={message}
                    onForward={(messageToForward) => {
                      const targetConversationId = window.prompt("Forward to conversation id");
                      if (targetConversationId) {
                        void actions.forwardMessage({
                          sourceConversationId: messageToForward.conversationId,
                          targetConversationId,
                          messageId: messageToForward.id
                        });
                      }
                    }}
                    onReply={setReplyingTo}
                  />
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

            {replyingTo ? (
              <div className="chatemi__replying">
                <span>
                  Replying to <strong>{replyingTo.sender.name}</strong>: {replyingTo.text ?? replyingTo.attachments?.[0]?.name ?? "media"}
                </span>
                <button onClick={() => setReplyingTo(undefined)} type="button">
                  Cancel
                </button>
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

function DefaultMessage({
  message,
  isMine,
  enableActions,
  enableMediaPreview,
  onReply,
  onForward
}: {
  message: ChatEmiMessage;
  isMine: boolean;
  enableActions: boolean;
  enableMediaPreview: boolean;
  onReply: (message: ChatEmiMessage) => void;
  onForward: (message: ChatEmiMessage) => void;
}): ReactElement {
  return (
    <article className={`chatemi__message ${isMine ? "chatemi__message--mine" : ""}`}>
      {!isMine ? <strong className="chatemi__message-sender">{message.sender.name}</strong> : null}
      {message.forwardedFrom ? <div className="chatemi__forwarded">Forwarded from {message.forwardedFrom.name}</div> : null}
      {message.replyTo ? (
        <blockquote className="chatemi__reply-preview">
          <strong>{message.replyTo.sender.name}</strong>
          <span>{message.replyTo.text ?? message.replyTo.attachments?.[0]?.name ?? "media"}</span>
        </blockquote>
      ) : null}
      {message.text ? <p>{message.text}</p> : null}
      {message.html ? <div className="chatemi__message-html" dangerouslySetInnerHTML={{ __html: message.html }} /> : null}
      {message.attachments?.length ? (
        <div className="chatemi__message-attachments">
          {message.attachments.map((attachment) => renderAttachment(attachment, enableMediaPreview))}
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
        {isMine && message.status ? <span>{messageStatusLabel(message)}</span> : null}
      </footer>
      {enableActions ? (
        <div className="chatemi__message-actions">
          <button onClick={() => onReply(message)} type="button">
            Reply
          </button>
          <button onClick={() => onForward(message)} type="button">
            Forward
          </button>
        </div>
      ) : null}
    </article>
  );
}

function renderAttachment(attachment: ChatEmiAttachment, enableMediaPreview: boolean): ReactElement {
  if (enableMediaPreview && attachment.type === "image") {
    return (
      <a className="chatemi__media chatemi__media--image" href={attachment.url} key={attachment.id} rel="noreferrer" target="_blank">
        <img alt={attachment.caption ?? attachment.name ?? "image"} src={attachment.url} />
        {attachment.caption ? <span>{attachment.caption}</span> : null}
      </a>
    );
  }

  if (enableMediaPreview && attachment.type === "video") {
    return (
      <figure className="chatemi__media chatemi__media--video" key={attachment.id}>
        <video controls poster={attachment.thumbnailUrl} src={attachment.url} />
        <figcaption>{attachment.caption ?? attachment.name ?? "Video"}</figcaption>
      </figure>
    );
  }

  if (attachment.type === "voice" || attachment.type === "audio") {
    return (
      <div className="chatemi__media chatemi__media--audio" key={attachment.id}>
        <span>{attachment.type === "voice" ? "Voice message" : attachment.name ?? "Audio"}</span>
        <audio controls src={attachment.url} />
      </div>
    );
  }

  return (
    <a className="chatemi__media chatemi__media--file" href={attachment.url} key={attachment.id} rel="noreferrer" target="_blank">
      {attachment.thumbnailUrl ? <img alt="" src={attachment.thumbnailUrl} /> : null}
      <span>{attachment.name ?? attachment.type}</span>
      {attachment.size ? <small>{formatBytes(attachment.size)}</small> : null}
    </a>
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

function conversationStatus(conversation: ChatEmiConversation, currentUserId?: string): string {
  if (conversation.type === "channel") {
    return `${conversation.participants.length} subscribers`;
  }

  if (conversation.type === "group") {
    return `${conversation.participants.length} members`;
  }

  const otherUser = conversation.participants.find((participant) => participant.id !== currentUserId);

  if (!otherUser) {
    return "Saved messages";
  }

  if (otherUser.presence === "online") {
    return "online";
  }

  return otherUser.lastSeenAt ? `last seen ${relativeTime(otherUser.lastSeenAt)}` : "last seen recently";
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

function relativeTime(value: string): string {
  const diffMs = Date.now() - Date.parse(value);
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function messageStatusLabel(message: ChatEmiMessage): string {
  if (message.status === "read" || message.readBy?.length) return "read";
  if (message.status === "delivered" || message.deliveredTo?.length) return "delivered";
  return message.status ?? "sent";
}

function attachmentType(file: File): ChatEmiAttachment["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return file.name.toLowerCase().includes("voice") ? "voice" : "audio";
  return "file";
}

function messageKind(attachments: ChatEmiAttachment[]): ChatEmiMessage["kind"] {
  if (attachments.some((attachment) => attachment.type === "voice")) return "voice";
  if (attachments.length > 0) return "media";
  return "text";
}

function fallbackMember(user: ChatEmiUser) {
  return {
    user,
    role: "member" as const,
    joinedAt: new Date().toISOString()
  };
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
