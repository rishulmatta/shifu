import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The display face: a soft, slightly wonky serif for titles and big numbers (docs/design.md).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
});

const site = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Shifu", template: "%s · Shifu" },
  description: "Any topic, taught by the best moments on YouTube, and checked until it sticks.",
  openGraph: {
    title: "Shifu",
    description: "Any topic, taught by the best moments on YouTube, and checked until it sticks.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#151210" },
  ],
};

/**
 * Applies the saved theme before first paint, so a dark-mode learner never sees a flash of paper.
 * `?theme=light|dark` in the URL picks one and remembers it (handy for recordings).
 */
const themeScript = `try{var q=new URLSearchParams(location.search).get("theme"),t=q||localStorage.getItem("shifu-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;if(q)localStorage.setItem("shifu-theme",t)}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
