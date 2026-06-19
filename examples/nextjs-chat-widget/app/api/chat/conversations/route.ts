import { NextResponse } from "next/server";
import { getChatEmiMongo } from "../../../lib/chatemi-mongo";

export async function GET() {
  const { collections } = await getChatEmiMongo();
  const conversations = await collections.conversations.find({ archived: { $ne: true } }).sort({ updatedAt: -1 }).limit(50).toArray();

  return NextResponse.json({
    items: conversations,
    nextCursor: null
  });
}

export async function POST(request: Request) {
  const { collections } = await getChatEmiMongo();
  const input = await request.json();
  const now = new Date().toISOString();

  const conversation = {
    ...input,
    participants: [],
    createdAt: now,
    updatedAt: now,
    unreadCount: 0
  };

  await collections.conversations.insertOne(conversation);

  return NextResponse.json(conversation, { status: 201 });
}
