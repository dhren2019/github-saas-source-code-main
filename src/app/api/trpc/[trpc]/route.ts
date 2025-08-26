import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = (req: NextRequest) => {
  // Skip tRPC completely during build
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    return new NextResponse(JSON.stringify({ error: 'Build mode - tRPC disabled' }), { 
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Lazy import to avoid build-time issues
  const handleTRPC = async () => {
    const { env } = await import("@/env");
    const { appRouter } = await import("@/server/api/root");
    const { createTRPCContext } = await import("@/server/api/trpc");
    
    const createContext = async (req: NextRequest) => {
      return createTRPCContext({
        headers: req.headers,
      });
    };

    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: () => createContext(req),
      onError:
        env.NODE_ENV === "development"
          ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            );
          }
          : undefined,
    });
  };
  
  return handleTRPC();
};

export { handler as GET, handler as POST };
