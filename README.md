# ChatEmi

ChatEmi is a publish-ready React messaging package for building in-app messenger experiences. It includes:

- A typed REST API client for conversations, messages, attachments, reactions, read receipts, and search.
- A typed WebSocket client with reconnects, outbound queuing, typing, presence, receipts, and realtime conversation/message events.
- `ChatEmiProvider` for application layout/state.
- `useChatEmi` for product code that needs chat actions and state.
- `ChatEmiMessenger`, a default responsive Telegram-style UI that can be used immediately or customized.

## Install

```bash
npm install chatemi
```

```tsx
import { ChatEmiMessenger, ChatEmiProvider, useChatEmi } from "chatemi";
import "chatemi/styles.css";

export function App() {
  return (
    <ChatEmiProvider
      config={{
        apiBaseUrl: "https://api.example.com/chat",
        socketUrl: "wss://api.example.com/chat/socket",
        token: () => localStorage.getItem("access_token") ?? undefined
      }}
    >
      <ChatEmiMessenger />
    </ChatEmiProvider>
  );
}
```

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
          text: "Welcome to the chat"
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
| Conversations | `GET /conversations`, `POST /conversations` |
| Conversation detail | `GET /conversations/:conversationId`, `PATCH /conversations/:conversationId`, `DELETE /conversations/:conversationId` |
| Messages | `GET /conversations/:conversationId/messages`, `POST /conversations/:conversationId/messages` |
| Message detail | `PATCH /conversations/:conversationId/messages/:messageId`, `DELETE /conversations/:conversationId/messages/:messageId` |
| Read receipts | `POST /conversations/:conversationId/read` |
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
- `presence`

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
