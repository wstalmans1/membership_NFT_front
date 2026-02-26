import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { NetworkWarningBannerWrapper } from "@/components/NetworkWarningBannerWrapper";
import { TestEnvironmentBanner } from "@/components/TestEnvironmentBanner";
import { TooltipClamp } from "@/components/TooltipClamp";

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
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body
        className="antialiased"
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
