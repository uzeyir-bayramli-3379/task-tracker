import type { Metadata, Viewport } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./globals.css";

// Patrick Hand isn't a variable font — it needs an explicit weight.
const patrickHand = Patrick_Hand({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-patrick",
});

// Caveat is variable; the sketch UI uses the 600/700 range.
const caveat = Caveat({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Task Tracker",
  description: "A hand-drawn task tracker",
};

// Mobile shell: cover the safe area and lock zoom so the swipe deck
// and bottom bars behave like a native app.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${patrickHand.variable} ${caveat.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
