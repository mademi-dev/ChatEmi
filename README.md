# ChatEmi

ChatEmi is a publish-ready React messaging package for building in-app messenger experiences. It includes:

- A typed REST API client for conversations, messages, attachments, reactions, read receipts, and search.
- A typed WebSocket client with reconnects, outbound queuing, typing, presence, receipts, and realtime conversation/message events.
- Group, channel, direct, and bot conversation models with owner/admin/member roles.
- Delivered/read receipts, last-seen presence, replies, forwards, avatars, voice messages, images, videos, and files.
- A modern floating launcher with notification badge, draggable/resizable modal, and compact notification tray.
- Optional external user-directory API integration.
- Optional server-side MongoDB connection helpers for API backends.
- `ChatEmiProvider` for application layout/state.
- `useChatEmi` for product code that needs chat actions and state.
- `ChatEmiMessenger`, a default responsive light/dark Telegram-style UI that can be used immediately or customized.

## Install

```bash
npm install chatemi
```

```tsx
import { ChatEmiLauncher, ChatEmiMessenger, ChatEmiProvider, useChatEmi } from "chatemi";
import "chatemi/styles.css";

export function App() {
  return (
    <ChatEmiProvider
      config={{
        apiBaseUrl: "https://api.example.com/chat",
        socketUrl: "wss://api.example.com/chat/socket",
        token: () => localStorage.getItem("access_token") ?? undefined,
        theme: "violet",
        notifications: {
          enabled: true,
          browser: true,
          maxStored: 50
        },
        userDirectory: {
          baseUrl: "https://identity.example.com",
          searchPath: "/users/search",
          headers: () => ({
            Authorization: `Bearer ${localStorage.getItem("identity_token")}`
          })
        }
      }}
    >
      <ChatEmiLauncher theme="violet" />
    </ChatEmiProvider>
  );
}
```

## Next.js app usage

Import package CSS once from `app/layout.tsx`:

```tsx
import "chatemi/styles.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My app"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create a client component for the widget:

```tsx
"use client";

import { ChatEmiLauncher, ChatEmiProvider } from "chatemi";

export function ChatWidget() {
  return (
    <ChatEmiProvider
      config={{
        apiBaseUrl: process.env.NEXT_PUBLIC_CHAT_API_URL!,
        socketUrl: process.env.NEXT_PUBLIC_CHAT_SOCKET_URL,
        token: () => localStorage.getItem("access_token") ?? undefined,
        theme: "glass",
        notifications: {
          enabled: true,
          browser: true,
          showWhenOpen: false
        }
      }}
    >
      <ChatEmiLauncher
        defaultOpen={false}
        placement="bottom-right"
        theme="glass"
        title="Support"
        subtitle="Usually replies fast"
      />
    </ChatEmiProvider>
  );
}
```

Then render `<ChatWidget />` from any client component or include it in a page layout. The provider keeps the socket connected while the launcher modal is closed, so incoming `notification` and `message.created` events continue updating the badge in the background.

## Hook usage

```tsx
import { useChatEmi } from "chatemi";

export function SendWelcomeButton({ conversationId }: { conversationId: string }) {
  const { actions, activeMessages, connectionStatus } = useChatEmi();

  return (
    <button
      onClick={() =>
        actions.sendMessage({
          conversationId,
          text: "Welcome to the chat",
          replyToId: activeMessages.at(-1)?.id
        })
      }
    >
      Send ({activeMessages.length} loaded, socket {connectionStatus})
    </button>
  );
}
```

## Expected REST API contract

By default ChatEmi calls these paths under `apiBaseUrl`:

| Feature | Method/path |
| --- | --- |
| Current user | `GET /me` |
| Users | `GET /users?q=...`, `GET /users/:userId` |
| Conversations | `GET /conversations`, `POST /conversations` |
| Conversation detail | `GET /conversations/:conversationId`, `PATCH /conversations/:conversationId`, `DELETE /conversations/:conversationId` |
| Avatar | `PATCH /conversations/:conversationId/avatar`, `PATCH /users/:userId` |
| Members/admins | `POST /conversations/:conversationId/members`, `PATCH /conversations/:conversationId/members/:userId`, `DELETE /conversations/:conversationId/members/:userId` |
| Messages | `GET /conversations/:conversationId/messages`, `POST /conversations/:conversationId/messages` |
| Message detail | `PATCH /conversations/:conversationId/messages/:messageId`, `DELETE /conversations/:conversationId/messages/:messageId` |
| Read receipts | `POST /conversations/:conversationId/read` |
| Delivered receipts | `POST /conversations/:conversationId/delivered` |
| Forward | `POST /conversations/:conversationId/messages/:messageId/forward` |
| Reactions | `POST /conversations/:conversationId/messages/:messageId/reactions`, `DELETE /conversations/:conversationId/messages/:messageId/reactions` |
| Attachment upload | `POST /attachments` multipart form data |
| Search | `GET /search/messages?q=...` |

If your backend uses different paths, pass `config.endpoints` to override any route.

## Socket event contract

The socket sends and receives JSON envelopes:

```json
{
  "type": "message.created",
  "payload": {}
}
```

Built-in incoming event names include:

- `conversation.created`
- `conversation.updated`
- `conversation.deleted`
- `conversation.member.added`
- `conversation.member.updated`
- `conversation.member.removed`
- `message.created`
- `message.updated`
- `message.deleted`
- `message.receipt`
- `message.reaction`
- `typing`
- `presence`
- `notification`

Built-in outgoing helper events include:

- `conversation.subscribe`
- `conversation.unsubscribe`
- `typing`
- `message.read`
- `message.delivered`
- `message.forward`
- `conversation.member.update`
- `conversation.avatar.update`
- `presence`

## Launcher, themes, and notifications

Use `ChatEmiLauncher` when you want a floating in-app messenger:

```tsx
<ChatEmiLauncher
  placement="bottom-right"
  theme="midnight"
  title="Messages"
  subtitle="Team chat"
  initialSize={{ width: 460, height: 720 }}
  minSize={{ width: 360, height: 520 }}
  maxSize={{ width: 960, height: 860 }}
/>
```

The launcher includes:

- toggle button with unread notification badge
- draggable modal header on desktop
- native CSS resize handle on desktop
- compact notification tray above the chat
- mobile-friendly full-width modal behavior

Notification events should use this envelope:

```json
{
  "type": "notification",
  "payload": {
    "id": "notif_1",
    "kind": "message",
    "title": "Ava",
    "body": "Sent a new message",
    "conversationId": "chat_1",
    "messageId": "message_1",
    "createdAt": "2026-06-19T15:43:00.000Z"
  }
}
```

If the backend only emits `message.created`, ChatEmi creates a local message notification automatically for messages sent by other users.

Browser notifications are optional and request permission from a user gesture when the launcher opens:

```tsx
<ChatEmiProvider
  config={{
    apiBaseUrl: "https://api.example.com/chat",
    socketUrl: "wss://api.example.com/chat/socket",
    notifications: {
      enabled: true,
      browser: true,
      showWhenOpen: false,
      maxStored: 100
    }
  }}
>
  <ChatEmiLauncher />
</ChatEmiProvider>
```

## Groups, channels, admins, and members

Create groups and channels by calling the typed API or hook action:

```tsx
const { actions } = useChatEmi();

await actions.createConversation({
  type: "group",
  title: "Product Team",
  participantIds: ["user_1", "user_2"],
  avatarUrl: "https://cdn.example.com/product.png"
});

await actions.createConversation({
  type: "channel",
  title: "Announcements",
  participantIds: ["owner_1"],
  readOnly: true,
  publicUsername: "company_announcements"
});
```

Conversation members can include roles and permissions:

```ts
{
  user: { id: "user_1", name: "Ava" },
  role: "admin",
  permissions: ["manage_members", "pin_messages", "send_media"],
  joinedAt: "2026-06-19T00:00:00.000Z"
}
```

The default UI shows a member-management panel to owners/admins/moderators when `enableAdminControls` is enabled.

## Messages, receipts, replies, forwards, and media

Messages support:

- text and HTML bodies
- `replyToId`/`replyTo`
- `forwardedFrom`, `forwardedFromConversationId`, and `forwardedFromMessageId`
- `deliveredTo` and `readBy` receipts
- images, videos, audio, voice messages, generic files, locations, and contacts

```tsx
await actions.sendMessage({
  conversationId: "chat_1",
  text: "Here is the design",
  replyToId: "message_1",
  attachments: [
    {
      id: "attachment_1",
      type: "image",
      url: "https://cdn.example.com/design.png",
      name: "design.png"
    }
  ]
});

await actions.forwardMessage({
  sourceConversationId: "chat_1",
  targetConversationId: "chat_2",
  messageId: "message_1"
});
```

## Last seen and presence

Users can include `presence` and `lastSeenAt`. The default UI renders direct chats as `online`, `last seen 4m ago`, or `last seen recently`.

```ts
{
  id: "user_1",
  name: "Ava",
  presence: "offline",
  lastSeenAt: "2026-06-19T14:00:00.000Z"
}
```

## External user API

Use `config.userDirectory` when users live outside your chat backend. ChatEmi will call that API for user search and user details without leaking the chat API bearer token unless you add it yourself in `userDirectory.headers`.

```tsx
<ChatEmiProvider
  config={{
    apiBaseUrl: "https://api.example.com/chat",
    userDirectory: {
      baseUrl: "https://identity.example.com",
      searchPath: "/directory/users",
      userPath: (userId) => `/directory/users/${userId}`,
      headers: async () => ({
        Authorization: `Bearer ${await getIdentityToken()}`
      }),
      mapUser: (raw) => {
        const user = raw as { id: string; displayName: string; photo?: string };
        return {
          id: user.id,
          name: user.displayName,
          avatarUrl: user.photo
        };
      }
    }
  }}
>
  <ChatEmiMessenger />
</ChatEmiProvider>
```

## MongoDB backend integration

MongoDB must be connected from your API server, not from browser React code. Install the optional peer dependency in your backend:

```bash
npm install chatemi mongodb
```

```ts
import { createChatEmiMongoConnection } from "chatemi/server";

const chatDb = await createChatEmiMongoConnection({
  uri: process.env.MONGODB_URI!,
  databaseName: "chatemi",
  // Pass MongoClient options that match your deployment. ChatEmi intentionally
  // does not guess pool sizes because serverless and long-running servers need
  // different connection strategies.
  clientOptions: {
    appName: "chatemi-api"
  }
});

await chatDb.ensureIndexes();

export const conversations = chatDb.collections.conversations;
export const messages = chatDb.collections.messages;
export const members = chatDb.collections.members;
export const receipts = chatDb.collections.receipts;
export const attachments = chatDb.collections.attachments;
```

Connection guidance:

- Create one MongoDB client per server process and reuse it.
- Do not put MongoDB credentials in React/browser code.
- For serverless functions, initialize the connection outside the handler so warm invocations reuse it.
- For long-running servers, pass pool/timeouts through `clientOptions` based on observed concurrency and MongoDB connection metrics.

## Light mode and dark mode

Use `theme="light"`, `theme="dark"`, `theme="system"`, `theme="midnight"`, `theme="glass"`, `theme="emerald"`, or `theme="violet"`:

```tsx
<ChatEmiLauncher theme="glass" />
```

## Customizing the UI

```tsx
<ChatEmiMessenger
  composerPlaceholder="Message the team"
  renderConversation={(conversation, isActive) => (
    <span style={{ fontWeight: isActive ? 800 : 500 }}>{conversation.title}</span>
  )}
  renderMessage={(message, isMine) => (
    <div className={isMine ? "mine" : "theirs"}>{message.text}</div>
  )}
/>
```

## Development

```bash
npm install
npm run typecheck
npm run build
```

## Publishing

Update the version in `package.json`, then run:

```bash
npm publish
```
