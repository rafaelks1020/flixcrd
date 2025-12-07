import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Middleware para CORS em rotas de API
function corsMiddleware(request: NextRequest) {
  // Handle preflight OPTIONS
  if (request.method === "OPTIONS") {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  // Add CORS headers to response
  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// Auth middleware para rotas protegidas
const authMiddleware = withAuth(
  function middleware() {},
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const isLoggedIn = !!token;
        if (!isLoggedIn) return false;

        const path = req.nextUrl.pathname;
        const isAdminRoute = path.startsWith("/admin");

        if (isAdminRoute) {
          return (token as any).role === "ADMIN";
        }

        return true;
      },
    },
  },
);

export default function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // CORS para todas as rotas de API
  if (path.startsWith("/api/")) {
    return corsMiddleware(request);
  }

  // Auth para rotas protegidas
  if (path.startsWith("/admin") || path.startsWith("/watch") || path.startsWith("/title")) {
    return (authMiddleware as any)(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*", "/watch/:path*", "/title/:path*"],
};
