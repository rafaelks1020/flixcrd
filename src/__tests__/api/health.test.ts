import { createMocks } from 'node-mocks-http'
import { GET } from '@/app/api/health/route'

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  },
}))

describe('/api/health', () => {
  it('should return health status successfully', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/health',
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('ok')
    expect(data.database).toBe('connected')
    expect(data.timestamp).toBeDefined()
  })

  it('should handle database connection error', async () => {
    // Mock database error
    const { prisma } = require('@/lib/prisma')
    prisma.$queryRaw.mockRejectedValueOnce(new Error('Connection failed'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('error')
    expect(data.database).toBe('disconnected')
    expect(data.error).toBeDefined()
  })
})
