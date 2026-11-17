import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  weight: "variable",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "SharpFlyer AI",
  description: "Pick a design. Add your details. Export a flyer you can post today.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "SharpFlyer AI",
    title: "SharpFlyer AI",
    description: "Pick a design. Add your details. Export a flyer you can post today.",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "SharpFlyer AI flyer creation" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SharpFlyer AI",
    description: "Pick a design. Add your details. Export a flyer you can post today.",
    images: ["/og-image.svg"],
  },
};

const themeScript = `(() => {
  try {
    const saved = localStorage.getItem("sharpflyer-theme");
    const theme = saved === "light" || saved === "dark" ? saved : "system";
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = theme;
  } catch {}
})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-NG" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
