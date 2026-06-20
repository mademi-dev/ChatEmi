import "chatemi/styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ChatWidget } from "./components/ChatWidget";

export const metadata: Metadata = {
  title: "ChatEmi Next.js example",
  description: "A Next.js app using the ChatEmi launcher widget."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
