"use client";
import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import TopLoader from "@/components/top-loader";
import { Toaster } from "sonner";
import { TRPCReactProvider } from "@/trpc/react";

export default function ClerkProviderClient({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <TopLoader />
      <TRPCReactProvider>{children}</TRPCReactProvider>
      <Toaster richColors />
    </ClerkProvider>
  );
}
