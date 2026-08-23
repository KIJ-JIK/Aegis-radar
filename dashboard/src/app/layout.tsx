import type { Metadata } from "next";
import { Share_Tech_Mono, Space_Mono } from "next/font/google";
import "./globals.css";

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "Aegis Radar",
  description: "Autonomous Self-Healing Web Radar powered by Scraper Studio & Gemini AI",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo.svg", type: "image/svg+xml" }
    ],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/logo.svg" }]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${shareTechMono.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[#020502] text-white font-mono selection:bg-emerald-500 selection:text-black"
        style={{ fontFamily: "var(--font-share-tech-mono), 'Share Tech Mono', monospace" }}
      >
        {children}
      </body>
    </html>
  );
}
