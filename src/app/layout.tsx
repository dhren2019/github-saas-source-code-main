import "@/styles/globals.css";
import TopLoader from "@/components/top-loader";
import { Toaster } from "sonner";
import ClerkProviderClient from "@/components/clerk-provider-client";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "@/trpc/react";
import { ClerkProvider } from '@clerk/nextjs'

export const metadata: Metadata = {
  title: "Dionysus",
  description: "AI Powered Github Dev Tool",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        {/* Keep client-only providers inside body so the <html> element stays server-rendered */}
        <ClerkProviderClient>{children}</ClerkProviderClient>
      </body>
    </html>
  );
}
