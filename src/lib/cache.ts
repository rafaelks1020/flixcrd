import { createClient, RedisClientType } from 'redis'

// Redis client singleton.
// O Redis é OPCIONAL: sem REDIS_URL o cache fica desligado e cada chamada
// cai direto no banco. Se a conexão falhar, o cache é ignorado por 60 s,
// para nenhuma requisição ficar presa esperando o Redis.
let redisClient: RedisClientType | null = null
let indisponivelAte = 0

export async function getRedisClient(): Promise<RedisClientType> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    throw new Error('Cache desligado: REDIS_URL não configurada')
  }
  if (Date.now() < indisponivelAte) {
    throw new Error('Cache temporariamente indisponível')
  }

  if (!redisClient) {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 3000,
        // Sem reconexão automática: falha rápido e tenta de novo depois do intervalo
        reconnectStrategy: false,
      },
    })

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err?.message ?? err)
    })
  }

  if (!redisClient.isOpen) {
    try {
      await redisClient.connect()
    } catch (error) {
      redisClient = null
      indisponivelAte = Date.now() + 60_000
      throw error
    }
  }

  return redisClient
}

// Cache desligado de propósito não é erro: não polui o log
function logCacheError(op: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.startsWith('Cache desligado') || msg.startsWith('Cache temporariamente')) return
  console.error(`Cache ${op} error:`, msg)
}

// Cache helper functions
export class CacheService {
  private static instance: CacheService

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  async getClient(): Promise<RedisClientType> {
    // Sempre passa pelo getRedisClient, que respeita o desligamento e a pausa após falha
    return getRedisClient()
  }

  // Get value from cache
  async get(key: string): Promise<string | null> {
    try {
      const client = await this.getClient()
      return await client.get(key)
    } catch (error) {
      logCacheError('get', error)
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
      logCacheError('set', error)
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
      logCacheError('del', error)
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
      logCacheError('exists', error)
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
      logCacheError('clear', error)
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
      logCacheError('getOrSet', error)
      // Fallback to direct fetch
      return fetchFn()
    }
  }
}

export default CacheService.getInstance()
