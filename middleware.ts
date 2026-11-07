import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

interface ExtendedToken extends JWT {
  role?: string;
  approvalStatus?: string;
}

const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // Origem fora da lista não recebe Access-Control-Allow-Origin.
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function applyCors(response: NextResponse, headers: Record<string, string>) {
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function isCronSecretApi(path: string) {
  return path === "/api/admin/uptime/record" || path.startsWith("/api/admin/uptime/record/");
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

export default async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // CORS para todas as rotas de API. Admin de API também exige role no JWT.
  if (path.startsWith("/api/")) {
    const corsHeaders = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return applyCors(NextResponse.json({}), corsHeaders);
    }

    if (path.startsWith("/api/admin/") && !isCronSecretApi(path)) {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token) {
        return applyCors(
          NextResponse.json({ error: "Não autorizado" }, { status: 401 }),
          corsHeaders,
        );
      }

      if ((token as ExtendedToken).role !== "ADMIN") {
        return applyCors(
          NextResponse.json({ error: "Acesso negado" }, { status: 403 }),
          corsHeaders,
        );
      }
    }

    return applyCors(NextResponse.next(), corsHeaders);
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
