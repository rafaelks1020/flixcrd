import { logger, logError, logApiCall, logPerformance } from '@/lib/logger'
import winston from 'winston'

// Mock winston module completely
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    add: jest.fn(),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      json: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn(),
      simple: jest.fn()
    },
    transports: {
      File: jest.fn(),
      Console: jest.fn()
    },
    exceptionHandlers: [],
    rejectionHandlers: []
  }

  return {
    createLogger: jest.fn(() => mockLogger),
    format: mockLogger.format,
    transports: mockLogger.transports
  }
})

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('logError', () => {
    it('should log error with stack trace', () => {
      const error = new Error('Test error')
      const context = { userId: '123' }

      logError('Test message', error, context)

      expect(logger.error).toHaveBeenCalledWith('Test message', {
        error: 'Test error',
        stack: expect.any(String),
        userId: '123'
      })
    })

    it('should handle error without context', () => {
      const error = new Error('Test error')

      logError('Test message', error)

      expect(logger.error).toHaveBeenCalledWith('Test message', {
        error: 'Test error',
        stack: expect.any(String)
      })
    })
  })

  describe('logApiCall', () => {
    it('should log API call with all parameters', () => {
      logApiCall('GET', '/api/test', 'user123', 150)

      expect(logger.info).toHaveBeenCalledWith('API Call', {
        method: 'GET',
        url: '/api/test',
        userId: 'user123',
        duration: 150,
        timestamp: expect.any(String)
      })
    })

    it('should log API call without optional parameters', () => {
      logApiCall('POST', '/api/test')

      expect(logger.info).toHaveBeenCalledWith('API Call', {
        method: 'POST',
        url: '/api/test',
        userId: undefined,
        duration: undefined,
        timestamp: expect.any(String)
      })
    })
  })

  describe('logPerformance', () => {
    it('should log performance metric under 1s as info', () => {
      logPerformance('database_query', 500)

      expect(logger.log).toHaveBeenCalledWith('info', 'Performance Metric', {
        operation: 'database_query',
        duration: 500,
        unit: 'ms'
      })
    })

    it('should log performance metric over 1s as warn', () => {
      logPerformance('slow_operation', 1500)

      expect(logger.log).toHaveBeenCalledWith('warn', 'Performance Metric', {
        operation: 'slow_operation',
        duration: 1500,
        unit: 'ms'
      })
    })

    it('should log performance metric with context', () => {
      const context = { query: 'SELECT * FROM users' }
      logPerformance('database_query', 800, context)

      expect(logger.log).toHaveBeenCalledWith('info', 'Performance Metric', {
        operation: 'database_query',
        duration: 800,
        unit: 'ms',
        query: 'SELECT * FROM users'
      })
    })
  })
})
