import { PointerEvent, ReactElement, useMemo, useRef, useState } from "react";
import { useChatEmi } from "../context";
import { ChatEmiMessenger } from "./ChatEmiMessenger";
import type { ChatEmiLauncherProps } from "../types";

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

const defaultSize = {
  width: 420,
  height: 680
};

const defaultMinSize = {
  width: 340,
  height: 480
};

const defaultMaxSize = {
  width: 920,
  height: 860
};

export function ChatEmiLauncher({
  className,
  title = "Messages",
  subtitle = "ChatEmi",
  placement = "bottom-right",
  defaultOpen = false,
  showNotificationList = true,
  badgeCount,
  initialSize = defaultSize,
  minSize = defaultMinSize,
  maxSize = defaultMaxSize,
  markNotificationsReadOnOpen = true,
  launcherIcon,
  ...messengerProps
}: ChatEmiLauncherProps): ReactElement {
  const { actions, conversations, connectionStatus, notifications, theme, unreadNotificationCount } = useChatEmi();
  const [open, setOpen] = useState(defaultOpen);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<DragState>();

  const conversationUnreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + (conversation.unreadCount ?? 0), 0),
    [conversations]
  );
  const resolvedBadgeCount = badgeCount ?? (unreadNotificationCount > 0 ? unreadNotificationCount : conversationUnreadCount);

  function toggleOpen(): void {
    setOpen((currentOpen) => {
      const nextOpen = !currentOpen;

      if (nextOpen && markNotificationsReadOnOpen) {
        actions.markNotificationsRead();
      }

      if (nextOpen) {
        void actions.requestNotificationPermission();
      }

      return nextOpen;
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement).closest("button")) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const currentDrag = dragState.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    setOffset({
      x: currentDrag.originX + event.clientX - currentDrag.startX,
      y: currentDrag.originY + event.clientY - currentDrag.startY
    });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (dragState.current?.pointerId === event.pointerId) {
      dragState.current = undefined;
    }
  }

  return (
    <div className={["chatemi-launcher", `chatemi-launcher--${placement}`, className].filter(Boolean).join(" ")} data-theme={messengerProps.theme ?? theme}>
      {open ? (
        <section
          aria-label={title}
          className="chatemi-launcher__modal"
          style={{
            width: initialSize.width,
            height: initialSize.height,
            minWidth: minSize.width,
            minHeight: minSize.height,
            maxWidth: maxSize.width,
            maxHeight: maxSize.height,
            transform: `translate(${offset.x}px, ${offset.y}px)`
          }}
        >
          <div
            className="chatemi-launcher__modal-header"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div>
              <strong>{title}</strong>
              <span>{subtitle} · {connectionStatus}</span>
            </div>
            <button aria-label="Close messages" onClick={toggleOpen} type="button">
              Close
            </button>
          </div>

          {showNotificationList && notifications.length > 0 ? (
            <div className="chatemi-launcher__notifications" aria-label="Notifications">
              {notifications.slice(0, 3).map((notification) => (
                <button
                  className={notification.read ? "chatemi-launcher__notification" : "chatemi-launcher__notification chatemi-launcher__notification--unread"}
                  key={notification.id}
                  onClick={() => {
                    if (notification.conversationId) {
                      void actions.openConversation(notification.conversationId);
                    }
                    actions.markNotificationsRead([notification.id]);
                  }}
                  type="button"
                >
                  {notification.avatarUrl ? <img alt="" src={notification.avatarUrl} /> : <span>{notification.title.slice(0, 2).toUpperCase()}</span>}
                  <span>
                    <strong>{notification.title}</strong>
                    {notification.body ? <small>{notification.body}</small> : null}
                  </span>
                </button>
              ))}
              <button className="chatemi-launcher__clear" onClick={actions.clearNotifications} type="button">
                Clear
              </button>
            </div>
          ) : null}

          <ChatEmiMessenger {...messengerProps} />
        </section>
      ) : null}

      <button aria-expanded={open} aria-label={open ? "Close messages" : "Open messages"} className="chatemi-launcher__toggle" onClick={toggleOpen} type="button">
        <span className="chatemi-launcher__icon">{launcherIcon ?? <DefaultLauncherIcon />}</span>
        {resolvedBadgeCount > 0 ? <span className="chatemi-launcher__badge">{resolvedBadgeCount > 99 ? "99+" : resolvedBadgeCount}</span> : null}
      </button>
    </div>
  );
}

function DefaultLauncherIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="28" viewBox="0 0 28 28" width="28">
      <path d="M5 13.4C5 8.76 8.98 5 13.9 5h.2C19.02 5 23 8.76 23 13.4c0 4.62-3.98 8.38-8.9 8.38h-.64c-.42 0-.83.12-1.18.34l-3.54 2.2a.75.75 0 0 1-1.14-.64l.18-3.2a1.8 1.8 0 0 0-.5-1.36A8.06 8.06 0 0 1 5 13.4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M10 12.5h8M10 16h5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
