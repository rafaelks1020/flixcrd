import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import type { JWT } from "next-auth/jwt";

interface ExtendedToken extends JWT {
  role?: string;
  approvalStatus?: string;
}

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
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Se não é admin e não está aprovado, redirecionar para pending-approval
    // Exceto se já está na página pending-approval ou em rotas públicas
    if (token && (token as ExtendedToken).role !== "ADMIN") {
      const approvalStatus = (token as ExtendedToken).approvalStatus;
      const isApproved = approvalStatus === "APPROVED";
      const isPendingPage = path === "/pending-approval";

      // Se não está aprovado e não está na página de pending, redirecionar
      if (!isApproved && !isPendingPage) {
        return NextResponse.redirect(new URL("/pending-approval", req.url));
      }

      // Se está aprovado mas está na página pending, redirecionar para subscribe
      if (isApproved && isPendingPage) {
        return NextResponse.redirect(new URL("/subscribe", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const isLoggedIn = !!token;
        if (!isLoggedIn) return false;

        const path = req.nextUrl.pathname;
        const isAdminRoute = path.startsWith("/admin");

        if (isAdminRoute) {
          return (token as ExtendedToken).role === "ADMIN";
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

  // Auth para rotas protegidas (inclui verificação de aprovação)
  if (
    path.startsWith("/admin") ||
    path.startsWith("/watch") ||
    path.startsWith("/title") ||
    path.startsWith("/browse") ||
    path.startsWith("/profiles") ||
    path.startsWith("/settings") ||
    path.startsWith("/subscribe") ||
    path === "/pending-approval"
  ) {
    return (authMiddleware as any)(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/admin/:path*",
    "/watch/:path*",
    "/title/:path*",
    "/browse/:path*",
    "/profiles/:path*",
    "/settings/:path*",
    "/subscribe",
    "/pending-approval",
  ],
};
