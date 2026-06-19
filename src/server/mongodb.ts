import { MongoClient, type Collection, type Db, type Document, type MongoClientOptions } from "mongodb";

export interface ChatEmiMongoCollections {
  conversations: Collection<Document>;
  messages: Collection<Document>;
  members: Collection<Document>;
  receipts: Collection<Document>;
  attachments: Collection<Document>;
}

export interface ChatEmiMongoConnectionOptions {
  uri: string;
  databaseName: string;
  clientOptions?: MongoClientOptions;
  collectionNames?: Partial<Record<keyof ChatEmiMongoCollections, string>>;
}

export interface ChatEmiMongoConnection {
  client: MongoClient;
  db: Db;
  collections: ChatEmiMongoCollections;
  ensureIndexes: () => Promise<void>;
  close: () => Promise<void>;
}

const clients = new Map<string, Promise<MongoClient>>();

export async function createChatEmiMongoConnection(options: ChatEmiMongoConnectionOptions): Promise<ChatEmiMongoConnection> {
  const client = await getMongoClient(options.uri, options.clientOptions);
  const db = client.db(options.databaseName);
  const collectionNames = {
    conversations: "chatemi_conversations",
    messages: "chatemi_messages",
    members: "chatemi_members",
    receipts: "chatemi_receipts",
    attachments: "chatemi_attachments",
    ...options.collectionNames
  };

  const collections: ChatEmiMongoCollections = {
    conversations: db.collection(collectionNames.conversations),
    messages: db.collection(collectionNames.messages),
    members: db.collection(collectionNames.members),
    receipts: db.collection(collectionNames.receipts),
    attachments: db.collection(collectionNames.attachments)
  };

  return {
    client,
    db,
    collections,
    ensureIndexes: () => ensureChatEmiIndexes(collections),
    close: async () => {
      clients.delete(cacheKey(options.uri, options.clientOptions));
      await client.close();
    }
  };
}

export async function ensureChatEmiIndexes(collections: ChatEmiMongoCollections): Promise<void> {
  await Promise.all([
    collections.conversations.createIndex({ updatedAt: -1 }),
    collections.conversations.createIndex({ type: 1, publicUsername: 1 }, { sparse: true }),
    collections.messages.createIndex({ conversationId: 1, createdAt: -1 }),
    collections.messages.createIndex({ conversationId: 1, senderId: 1, createdAt: -1 }),
    collections.members.createIndex({ conversationId: 1, userId: 1 }, { unique: true }),
    collections.members.createIndex({ userId: 1, role: 1 }),
    collections.receipts.createIndex({ conversationId: 1, messageId: 1, userId: 1, status: 1 }, { unique: true }),
    collections.attachments.createIndex({ conversationId: 1, createdAt: -1 })
  ]);
}

async function getMongoClient(uri: string, clientOptions?: MongoClientOptions): Promise<MongoClient> {
  const key = cacheKey(uri, clientOptions);
  const existingClient = clients.get(key);

  if (existingClient) {
    return existingClient;
  }

  // The package does not guess pool sizes. Pass clientOptions based on your
  // serverless or long-running server workload and monitor MongoDB connection usage.
  const clientPromise = new MongoClient(uri, clientOptions).connect();
  clients.set(key, clientPromise);
  return clientPromise;
}

function cacheKey(uri: string, clientOptions?: MongoClientOptions): string {
  return `${uri}:${JSON.stringify(clientOptions ?? {})}`;
}
