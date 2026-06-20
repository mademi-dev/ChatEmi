"use client";

import { ChatEmiLauncher, ChatEmiProvider } from "@mademi_dev/chatemi";
import { useMemo } from "react";
import { createChatEmiConfig } from "../lib/chatemi-config";

export function ChatWidget() {
  const config = useMemo(() => createChatEmiConfig(), []);

  return (
    <ChatEmiProvider config={config}>
      <ChatEmiLauncher
        defaultOpen={false}
        markNotificationsReadOnOpen
        placement="bottom-right"
        showNotificationList
        subtitle="We are here to help"
        theme="glass"
        title="Messages"
        initialSize={{
          width: 460,
          height: 720
        }}
        minSize={{
          width: 360,
          height: 520
        }}
        maxSize={{
          width: 960,
          height: 860
        }}
      />
    </ChatEmiProvider>
  );
}
