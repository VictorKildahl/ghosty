import { ConvexClientProvider } from "./convex-provider";
import "./globals.css";

export const metadata = {
  title: "GhostWriter",
  description:
    "GhostWriter is an AI writing assistant that helps you write better messages, emails, and more.",
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
