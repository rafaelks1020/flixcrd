import winston from 'winston'

// Create logger with structured logging
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
      })
    })
  ),
  defaultMeta: {
    service: 'flixcrd-web',
    version: process.env.npm_package_version || '0.2.0'
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
    // Console for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
})

// Create a stream object for Morgan HTTP logging
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim())
  }
}

// Helper functions for structured logging
export const logWithContext = (level: string, message: string, context: any = {}) => {
  logger.log(level, message, context)
}

export const logError = (message: string, error: Error, context: any = {}) => {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...context
  })
}

export const logApiCall = (method: string, url: string, userId?: string, duration?: number) => {
  logger.info('API Call', {
    method,
    url,
    userId,
    duration,
    timestamp: new Date().toISOString()
  })
}

export const logAuth = (action: string, userId: string, success: boolean, context?: any) => {
  logger.info('Auth Event', {
    action,
    userId,
    success,
    ...context
  })
}

export const logPerformance = (operation: string, duration: number, context?: any) => {
  const level = duration > 1000 ? 'warn' : 'info'
  logger.log(level, 'Performance Metric', {
    operation,
    duration,
    unit: 'ms',
    ...context
  })
}

// Development vs Production handling
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}

export default logger
