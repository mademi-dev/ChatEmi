# ChatEmi implementation guide

This guide explains how to ship ChatEmi in a production application. It covers frontend setup, Next.js usage, backend API responsibilities, sockets, notifications, media, MongoDB, external user directories, theming, and release checks.

## 1. Architecture

ChatEmi is split into browser-safe and server-side pieces:

| Area | Import | Runs in | Purpose |
| --- | --- | --- | --- |
| React package | `chatemi` | Browser / React client | Provider, hook, API client, socket client, launcher, messenger UI |
| Styles | `chatemi/styles.css` | Browser | All default UI, themes, launcher modal, notification badge |
| Server helpers | `chatemi/server` | Node.js only | MongoDB connection helper and collection/index setup |

Do not expose database credentials to browser code. Browser code should call your authenticated HTTP and WebSocket APIs.

## 2. Next.js setup

### Install

```bash
npm install chatemi
```

If your API server uses ChatEmi MongoDB helpers:

```bash
npm install mongodb
```

### Import CSS once

In App Router, import CSS from `app/layout.tsx`:

```tsx
import "chatemi/styles.css";
```

### Create a client widget

The widget uses browser APIs (`localStorage`, WebSocket, notifications), so it must live in a client component:

```tsx
"use client";

import { ChatEmiLauncher, ChatEmiProvider } from "chatemi";
import { useMemo } from "react";

export function ChatWidget() {
  const config = useMemo(
    () => ({
      apiBaseUrl: process.env.NEXT_PUBLIC_CHAT_API_URL!,
      socketUrl: process.env.NEXT_PUBLIC_CHAT_SOCKET_URL,
      token: () => localStorage.getItem("access_token") ?? undefined,
      theme: "glass" as const,
      notifications: {
        enabled: true,
        browser: true,
        showWhenOpen: false,
        maxStored: 100
      }
    }),
    []
  );

  return (
    <ChatEmiProvider config={config}>
      <ChatEmiLauncher placement="bottom-right" theme="glass" />
    </ChatEmiProvider>
  );
}
```

## 3. Provider configuration

```ts
type ChatEmiConfig = {
  apiBaseUrl: string;
  socketUrl?: string;
  token?: string | (() => string | Promise<string | undefined> | undefined);
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  currentUser?: ChatEmiUser;
  endpoints?: ChatEmiEndpointOverrides;
  userDirectory?: ChatEmiUserDirectoryConfig;
  theme?: ChatEmiTheme;
  notifications?: ChatEmiNotificationConfig;
  reconnect?: {
    enabled?: boolean;
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
};
```

Recommended defaults:

```tsx
<ChatEmiProvider
  config={{
    apiBaseUrl: "https://api.example.com/chat",
    socketUrl: "wss://api.example.com/chat/socket",
    token: () => auth.getAccessToken(),
    theme: "system",
    notifications: {
      enabled: true,
      browser: true,
      showWhenOpen: false,
      maxStored: 100
    },
    reconnect: {
      enabled: true,
      initialDelayMs: 500,
      maxDelayMs: 8000
    }
  }}
>
  <ChatEmiLauncher />
</ChatEmiProvider>
```

## 4. Launcher behavior

`ChatEmiLauncher` is the recommended app integration:

- Floating toggle button.
- Notification count badge.
- Draggable desktop modal.
- Resizable desktop modal.
- Full-width mobile modal.
- Notification tray.
- Keeps provider/socket running while closed.

```tsx
<ChatEmiLauncher
  title="Support"
  subtitle="Usually replies fast"
  placement="bottom-right"
  theme="midnight"
  defaultOpen={false}
  showNotificationList
  markNotificationsReadOnOpen
  initialSize={{ width: 460, height: 720 }}
  minSize={{ width: 360, height: 520 }}
  maxSize={{ width: 960, height: 860 }}
/>
```

## 5. Notifications

ChatEmi stores notifications inside provider state:

```tsx
const {
  notifications,
  unreadNotificationCount,
  actions
} = useChatEmi();

actions.markNotificationsRead();
actions.dismissNotification("notification_1");
actions.clearNotifications();
```

### Socket notification event

```json
{
  "type": "notification",
  "payload": {
    "id": "notif_1",
    "kind": "message",
    "title": "Ava",
    "body": "Sent a new message",
    "conversationId": "conversation_1",
    "messageId": "message_1",
    "read": false,
    "createdAt": "2026-06-19T21:05:00.000Z"
  }
}
```

If your backend only emits `message.created`, ChatEmi automatically creates a local notification for messages sent by other users.

Browser notifications are optional and require user permission. ChatEmi requests permission from a user gesture when the launcher opens.

## 6. Backend responsibilities

The package gives you UI and clients. Your backend owns:

- Authentication and authorization.
- Persisting conversations, messages, members, receipts, attachments.
- Enforcing admin/member permissions.
- Uploading media to your storage provider.
- Broadcasting WebSocket events.
- Mapping external users to `ChatEmiUser`.

Minimum production endpoints:

- `GET /me`
- `GET /conversations`
- `POST /conversations`
- `GET /conversations/:conversationId/messages`
- `POST /conversations/:conversationId/messages`
- `POST /conversations/:conversationId/read`
- `POST /conversations/:conversationId/delivered`
- `POST /attachments`

See `docs/BACKEND_CONTRACT.md` for full details.

## 7. MongoDB integration

Use `chatemi/server` only from Node.js:

```ts
import { createChatEmiMongoConnection } from "chatemi/server";

const chatDb = await createChatEmiMongoConnection({
  uri: process.env.MONGODB_URI!,
  databaseName: "chatemi",
  clientOptions: {
    appName: "chatemi-api"
  }
});

await chatDb.ensureIndexes();
```

Connection guidance:

- Create the client once per process and reuse it.
- In serverless, initialize outside the handler so warm invocations reuse the client.
- Do not guess pool sizes. Use `clientOptions` based on deployment type, concurrency, and MongoDB metrics.
- Monitor `connections.current`, query latency, and wait queue behavior.

## 8. External user directory

Use this when users live in another service:

```tsx
userDirectory: {
  baseUrl: "https://identity.example.com",
  searchPath: "/users/search",
  userPath: (userId) => `/users/${userId}`,
  headers: () => ({
    Authorization: `Bearer ${identityToken()}`
  }),
  mapUser: (raw) => {
    const user = raw as { id: string; displayName: string; photoUrl?: string };
    return {
      id: user.id,
      name: user.displayName,
      avatarUrl: user.photoUrl
    };
  }
}
```

ChatEmi does not automatically send the chat API bearer token to the external user API. Add headers explicitly if needed.

## 9. Themes

Built-in themes:

- `light`
- `dark`
- `system`
- `midnight`
- `glass`
- `emerald`
- `violet`

Use the provider default:

```tsx
<ChatEmiProvider config={{ apiBaseUrl, theme: "violet" }}>
  <ChatEmiLauncher />
</ChatEmiProvider>
```

Or override per UI component:

```tsx
<ChatEmiLauncher theme="glass" />
```

## 10. Production checklist

Before publishing or deploying:

- Confirm package name and npm scope.
- Confirm `apiBaseUrl` and `socketUrl` point to production services.
- Verify auth token refresh behavior.
- Verify CORS for REST and WebSocket APIs.
- Verify attachment upload limits and file scanning.
- Verify admin permissions server-side.
- Verify socket reconnects after network loss.
- Verify notification permission behavior in Chrome, Safari, Firefox.
- Verify mobile launcher modal behavior.
- Run:

```bash
npm run typecheck
npm run build
npm pack --dry-run
```
