import { withAuth } from "next-auth/middleware";

export default withAuth(
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

export const config = {
  matcher: ["/admin/:path*", "/watch/:path*", "/title/:path*"],
};
