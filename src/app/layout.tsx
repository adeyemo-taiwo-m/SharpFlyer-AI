import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SharpFlyer AI",
  description: "A Next.js application built with SharpFlyer AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
