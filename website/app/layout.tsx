import "./globals.css";

export const metadata = {
  title: "GhostWriter - Just ghost write it.",
  description:
    "Voice-powered ghostwriting that turns speech into clean, ready-to-paste text. Works everywhere on your Mac.",
  icons: {
    icon: "/ghosty.png",
    apple: "/ghosty.png",
  },
  openGraph: {
    title: "GhostWriter - Just ghost write it.",
    description:
      "Voice-powered ghostwriting that turns speech into clean, ready-to-paste text.",
    type: "website",
  },
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
      <body>{children}</body>
    </html>
  );
}
