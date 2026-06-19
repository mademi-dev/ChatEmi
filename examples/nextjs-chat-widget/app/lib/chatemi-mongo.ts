import { createChatEmiMongoConnection } from "chatemi/server";

let connectionPromise: ReturnType<typeof createChatEmiMongoConnection> | undefined;

export function getChatEmiMongo() {
  if (!connectionPromise) {
    connectionPromise = createChatEmiMongoConnection({
      uri: requiredServerEnv("MONGODB_URI"),
      databaseName: process.env.MONGODB_DB ?? "chatemi",
      clientOptions: {
        appName: "chatemi-nextjs-example"
      }
    });
  }

  return connectionPromise;
}

function requiredServerEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
