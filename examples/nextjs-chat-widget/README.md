# ChatEmi Next.js widget example

This example shows how to use ChatEmi in a Next.js App Router application with:

- `ChatEmiProvider`
- `ChatEmiLauncher`
- floating notification badge
- draggable/resizable modal
- browser notifications
- external user-directory configuration
- server-side MongoDB helper usage

The files are intentionally small and copy-paste friendly. They are not a standalone app inside this repository; copy them into a Next.js project that has `next`, `react`, `react-dom`, `@mademi_dev/chatemi`, and optionally `mongodb` installed.

## Install in your app

```bash
npm install @mademi_dev/chatemi
```

If you also use the MongoDB server helpers:

```bash
npm install mongodb
```

## Environment variables

```bash
NEXT_PUBLIC_CHAT_API_URL=https://api.example.com/chat
NEXT_PUBLIC_CHAT_SOCKET_URL=wss://api.example.com/chat/socket
NEXT_PUBLIC_IDENTITY_API_URL=https://identity.example.com
MONGODB_URI=mongodb+srv://...
MONGODB_DB=chatemi
```

Only `NEXT_PUBLIC_*` values are sent to the browser. Keep `MONGODB_URI` server-side only.

## Files

- `app/layout.tsx` imports `@mademi_dev/chatemi/styles.css` once.
- `app/components/ChatWidget.tsx` is the client-side launcher widget.
- `app/lib/chatemi-config.ts` centralizes browser-safe config.
- `app/lib/chatemi-mongo.ts` shows server-side MongoDB setup.
- `app/api/chat/conversations/route.ts` shows how an API route can read MongoDB.
- `app/api/chat/socket-events/route.ts` documents example socket event payloads.
