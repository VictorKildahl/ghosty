import { ConvexClientProvider } from "./convex-provider";
import "./globals.css";

export const metadata = {
  title: "GhostWriter",
  description:
    "GhostWriter — you talk, it writes. Voice-powered ghostwriting that turns speech into clean, ready-to-paste text.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </head>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
