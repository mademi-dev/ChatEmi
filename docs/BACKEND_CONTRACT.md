# ChatEmi backend contract

This document describes the REST, WebSocket, and data contracts expected by the default ChatEmi API client and UI.

## REST shape

All JSON endpoints should return JSON. Paginated list endpoints should use:

```json
{
  "items": [],
  "nextCursor": null
}
```

Errors should use:

```json
{
  "message": "Human readable error",
  "code": "OPTIONAL_MACHINE_CODE"
}
```

## Authentication

The browser client sends:

```http
Authorization: Bearer <token>
```

Validate the token on every REST request and socket connection. Do not trust role/member data from the client.

## Users

```ts
type ChatEmiUser = {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  statusText?: string;
  presence?: "online" | "offline" | "away" | "busy" | "invisible";
  lastSeenAt?: string;
};
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/me` | Current authenticated user |
| `GET` | `/users?q=ava&limit=10` | Search users |
| `GET` | `/users/:userId` | User details |
| `PATCH` | `/users/:userId` | Update profile/avatar |

## Conversations

```ts
type ChatEmiConversation = {
  id: string;
  type: "direct" | "group" | "channel" | "bot";
  title?: string;
  description?: string;
  avatarUrl?: string;
  participants: ChatEmiUser[];
  members?: ChatEmiMember[];
  ownerId?: string;
  adminIds?: string[];
  publicUsername?: string;
  lastMessage?: ChatEmiMessage;
  unreadCount?: number;
  readOnly?: boolean;
  createdAt: string;
  updatedAt?: string;
};
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/conversations` | List conversations |
| `POST` | `/conversations` | Create direct/group/channel/bot conversation |
| `GET` | `/conversations/:conversationId` | Conversation detail |
| `PATCH` | `/conversations/:conversationId` | Update title, description, mute, archive, etc. |
| `DELETE` | `/conversations/:conversationId` | Archive/delete conversation |
| `PATCH` | `/conversations/:conversationId/avatar` | Update conversation avatar |

## Members and admins

```ts
type ChatEmiMember = {
  user: ChatEmiUser;
  role: "owner" | "admin" | "moderator" | "member" | "guest";
  permissions?: Array<
    | "send_messages"
    | "send_media"
    | "pin_messages"
    | "manage_messages"
    | "manage_members"
    | "manage_roles"
    | "manage_conversation"
    | "invite_members"
  >;
  joinedAt: string;
  mutedUntil?: string | null;
  bannedUntil?: string | null;
  title?: string;
};
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/conversations/:conversationId/members` | Add members `{ userIds: string[] }` |
| `PATCH` | `/conversations/:conversationId/members/:userId` | Update role, permissions, mute, ban |
| `DELETE` | `/conversations/:conversationId/members/:userId` | Remove member |

Server rules:

- Only owners/admins/moderators should manage members.
- Only owners/admins should promote admins unless your product says otherwise.
- Channels with `readOnly: true` should reject normal member messages.

## Messages

```ts
type ChatEmiMessage = {
  id: string;
  conversationId: string;
  sender: ChatEmiUser;
  kind?: "text" | "media" | "voice" | "system";
  text?: string;
  html?: string;
  attachments?: ChatEmiAttachment[];
  replyTo?: ChatEmiMessage;
  replyToId?: string;
  forwardedFrom?: ChatEmiUser;
  forwardedFromConversationId?: string;
  forwardedFromMessageId?: string;
  reactions?: ChatEmiReaction[];
  status?: "queued" | "sending" | "sent" | "delivered" | "read" | "failed";
  deliveredTo?: ChatEmiReceiptEvent[];
  readBy?: ChatEmiReceiptEvent[];
  createdAt: string;
};
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/conversations/:conversationId/messages` | List messages |
| `POST` | `/conversations/:conversationId/messages` | Send message |
| `PATCH` | `/conversations/:conversationId/messages/:messageId` | Edit message |
| `DELETE` | `/conversations/:conversationId/messages/:messageId` | Delete message |
| `POST` | `/conversations/:conversationId/messages/:messageId/forward` | Forward message |

Send message input:

```json
{
  "conversationId": "conversation_1",
  "text": "Hello",
  "replyToId": "message_1",
  "kind": "text",
  "attachments": []
}
```

## Attachments

```ts
type ChatEmiAttachment = {
  id: string;
  type: "image" | "video" | "audio" | "voice" | "file" | "location" | "contact";
  url: string;
  name?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  caption?: string;
};
```

Endpoint:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/attachments` | Multipart upload |

Expected response:

```json
{
  "id": "attachment_1",
  "type": "image",
  "url": "https://cdn.example.com/file.png",
  "name": "file.png",
  "mimeType": "image/png",
  "size": 12345
}
```

## Receipts

Endpoints:

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/conversations/:conversationId/delivered` | `{ "messageIds": ["message_1"] }` |
| `POST` | `/conversations/:conversationId/read` | `{ "messageIds": ["message_1"] }` |

Socket event:

```json
{
  "type": "message.receipt",
  "payload": {
    "conversationId": "conversation_1",
    "messageIds": ["message_1"],
    "userId": "user_2",
    "status": "read",
    "at": "2026-06-19T21:05:00.000Z"
  }
}
```

## WebSocket protocol

Every event is an envelope:

```json
{
  "type": "message.created",
  "payload": {}
}
```

Incoming events supported by the client:

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

Outgoing events sent by client helpers:

- `conversation.subscribe`
- `conversation.unsubscribe`
- `typing`
- `message.read`
- `message.delivered`
- `message.forward`
- `conversation.member.update`
- `conversation.avatar.update`
- `presence`

## Notification payload

```json
{
  "type": "notification",
  "payload": {
    "id": "notification_1",
    "kind": "message",
    "title": "Ava",
    "body": "Sent a message",
    "conversationId": "conversation_1",
    "messageId": "message_1",
    "avatarUrl": "https://cdn.example.com/ava.png",
    "read": false,
    "createdAt": "2026-06-19T21:05:00.000Z"
  }
}
```

## Minimal implementation sequence

1. Implement `/me`.
2. Implement conversation list.
3. Implement message list/send.
4. Add WebSocket `message.created`.
5. Add receipts.
6. Add uploads.
7. Add members/admins.
8. Add notifications.
9. Add external user directory.
10. Add production monitoring and rate limits.
