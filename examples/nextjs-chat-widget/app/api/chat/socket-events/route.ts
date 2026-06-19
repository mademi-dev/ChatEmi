import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    messageCreated: {
      type: "message.created",
      payload: {
        id: "message_1",
        conversationId: "conversation_1",
        sender: {
          id: "user_1",
          name: "Ava",
          avatarUrl: "https://example.com/ava.png"
        },
        text: "Hello from ChatEmi",
        status: "sent",
        createdAt: new Date().toISOString()
      }
    },
    notification: {
      type: "notification",
      payload: {
        id: "notification_1",
        kind: "message",
        title: "Ava",
        body: "Hello from ChatEmi",
        conversationId: "conversation_1",
        messageId: "message_1",
        read: false,
        createdAt: new Date().toISOString()
      }
    },
    receipt: {
      type: "message.receipt",
      payload: {
        conversationId: "conversation_1",
        messageIds: ["message_1"],
        userId: "user_2",
        status: "read",
        at: new Date().toISOString()
      }
    }
  });
}
