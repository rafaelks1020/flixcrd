// Simple in-memory rate limiting store for Next.js API routes
const store = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
}

export function rateLimit({
  windowMs,
  max,
}: {
  windowMs: number
  max: number
}): (identifier: string) => RateLimitResult {
  return function (identifier: string): RateLimitResult {
    const now = Date.now()
    const key = identifier

    // Get or create entry
    let entry = store.get(key)
    
    if (!entry || now > entry.resetTime) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + windowMs,
      }
      store.set(key, entry)
      return {
        success: true,
        limit: max,
        remaining: max - 1,
        resetTime: entry.resetTime,
      }
    }

    // Update existing entry
    entry.count++
    
    if (entry.count > max) {
      return {
        success: false,
        limit: max,
        remaining: 0,
        resetTime: entry.resetTime,
      }
    }

    return {
      success: true,
      limit: max,
      remaining: max - entry.count,
      resetTime: entry.resetTime,
    }
  }
}

// Get client IP from request
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  return 'unknown'
}
