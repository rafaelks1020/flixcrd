import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuth } from 'next-auth/middleware'

// Security middleware
export default withAuth(
  function middleware(req: NextRequest) {
    const response = NextResponse.next()

    // Add security headers
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Public paths that don't require authentication
        const publicPaths = ['/api/auth', '/login', '/register', '/']
        const { pathname } = req.nextUrl

        // Allow public paths
        if (publicPaths.some(path => pathname.startsWith(path))) {
          return true
        }

        // Admin paths require admin role
        if (pathname.startsWith('/admin')) {
          return token?.role === 'admin'
        }

        // All other paths require authentication
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
