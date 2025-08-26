"use client";
import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import TopLoader from "@/components/top-loader";
import { Toaster } from "sonner";
import { TRPCReactProvider } from "@/trpc/react";

export default function ClerkProviderClient({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // More comprehensive check to skip Clerk during build/prerendering
  const shouldSkipClerk = React.useMemo(() => {
    // During build/static generation phase
    if (typeof window === 'undefined' && (
      process.env.SKIP_ENV_VALIDATION === "true" || 
      !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      process.env.NODE_ENV === 'production'
    )) {
      return true;
    }
    
    // In browser but no publishable key
    if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      return true;
    }
    
    return false;
  }, []);

  if (shouldSkipClerk) {
    return (
      <>
        <TopLoader />
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster richColors />
      </>
    );
  }

  return (
    <ClerkProvider>
      <TopLoader />
      <TRPCReactProvider>{children}</TRPCReactProvider>
      <Toaster richColors />
    </ClerkProvider>
  );
}
