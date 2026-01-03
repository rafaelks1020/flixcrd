import { createClient, RedisClientType } from 'redis'

// Redis client singleton
let redisClient: RedisClientType | null = null

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
      },
    })

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })

    redisClient.on('connect', () => {
      console.log('Redis Client Connected')
    })

    redisClient.on('ready', () => {
      console.log('Redis Client Ready')
    })
  }

  if (!redisClient.isOpen) {
    await redisClient.connect()
  }

  return redisClient
}

// Cache helper functions
export class CacheService {
  private static instance: CacheService
  private client: RedisClientType | null = null

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  async getClient(): Promise<RedisClientType> {
    if (!this.client) {
      this.client = await getRedisClient()
    }
    return this.client
  }

  // Get value from cache
  async get(key: string): Promise<string | null> {
    try {
      const client = await this.getClient()
      return await client.get(key)
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  // Set value in cache with TTL
  async set(key: string, value: string, ttl: number = 3600): Promise<boolean> {
    try {
      const client = await this.getClient()
      await client.setEx(key, ttl, value)
      return true
    } catch (error) {
      console.error('Cache set error:', error)
      return false
    }
  }

  // Delete key from cache
  async del(key: string): Promise<boolean> {
    try {
      const client = await this.getClient()
      await client.del(key)
      return true
    } catch (error) {
      console.error('Cache del error:', error)
      return false
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const client = await this.getClient()
      const result = await client.exists(key)
      return result === 1
    } catch (error) {
      console.error('Cache exists error:', error)
      return false
    }
  }

  // Clear all cache
  async clear(): Promise<boolean> {
    try {
      const client = await this.getClient()
      await client.flushDb()
      return true
    } catch (error) {
      console.error('Cache clear error:', error)
      return false
    }
  }

  // Cache with fallback to function
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get(key)
      if (cached) {
        return JSON.parse(cached)
      }

      // Fetch fresh data
      const data = await fetchFn()
      
      // Cache the result
      await this.set(key, JSON.stringify(data), ttl)
      
      return data
    } catch (error) {
      console.error('Cache getOrSet error:', error)
      // Fallback to direct fetch
      return fetchFn()
    }
  }
}

export default CacheService.getInstance()
