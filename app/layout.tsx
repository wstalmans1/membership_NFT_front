import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NetworkWarningBannerWrapper } from "@/components/NetworkWarningBannerWrapper";
import { TestEnvironmentBanner } from "@/components/TestEnvironmentBanner";
import { TooltipClamp } from "@/components/TooltipClamp";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  fallback: ['system-ui', 'arial'],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  fallback: ['monospace'],
});

export const metadata: Metadata = {
  title: "QAWL DAO",
  description: "Decentralized Autonomous Organization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <TestEnvironmentBanner />
          <NetworkWarningBannerWrapper />
          <TooltipClamp />
          {children}
        </Providers>
      </body>
    </html>
  );
}
