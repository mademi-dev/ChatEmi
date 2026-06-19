import type { ChatEmiConfig } from "chatemi";

export function createChatEmiConfig(): ChatEmiConfig {
  return {
    apiBaseUrl: requiredPublicEnv("NEXT_PUBLIC_CHAT_API_URL"),
    socketUrl: process.env.NEXT_PUBLIC_CHAT_SOCKET_URL,
    token: () => localStorage.getItem("access_token") ?? undefined,
    theme: "glass",
    notifications: {
      enabled: true,
      browser: true,
      showWhenOpen: false,
      maxStored: 100
    },
    userDirectory: {
      baseUrl: requiredPublicEnv("NEXT_PUBLIC_IDENTITY_API_URL"),
      searchPath: "/users/search",
      userPath: (userId) => `/users/${encodeURIComponent(userId)}`,
      headers: () => {
        const identityToken = localStorage.getItem("identity_token");
        return identityToken ? { Authorization: `Bearer ${identityToken}` } : {};
      },
      mapUser: (rawUser) => {
        const user = rawUser as {
          id: string;
          displayName?: string;
          name?: string;
          username?: string;
          avatarUrl?: string;
          photoUrl?: string;
        };

        return {
          id: user.id,
          name: user.displayName ?? user.name ?? user.username ?? "Unknown user",
          username: user.username,
          avatarUrl: user.avatarUrl ?? user.photoUrl
        };
      }
    }
  };
}

function requiredPublicEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
