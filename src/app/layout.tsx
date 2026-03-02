import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmaNavi",
  description: "調剤薬局コンサルシステム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
