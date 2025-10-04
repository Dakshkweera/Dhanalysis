// Centralized error handling utilities

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Yahoo Finance specific errors
export const handleYahooError = (error, symbol) => {
  const errorMsg = error.message.toLowerCase();
  
  // Stock not found
  if (errorMsg.includes('not found') || errorMsg.includes('404')) {
    return {
      success: false,
      error: `Stock symbol "${symbol}" not found.`,
      suggestion: 'Please verify the symbol format (e.g., TCS.NS for NSE stocks)',
      retryable: false
    };
  }
  
  // Network/timeout errors
  if (errorMsg.includes('timeout') || errorMsg.includes('econnrefused') || errorMsg.includes('network')) {
    return {
      success: false,
      error: 'Unable to connect to market data provider.',
      suggestion: 'Please try again in a few moments.',
      retryable: true
    };
  }
  
  // Rate limit
  if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
    return {
      success: false,
      error: 'Too many requests. Please wait a moment.',
      suggestion: 'Try again in 1 minute.',
      retryable: true
    };
  }
  
  // Generic API error
  return {
    success: false,
    error: 'Unable to fetch stock data at the moment.',
    suggestion: 'Please try again later.',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    retryable: true
  };
};

// Database error handling
export const handleDbError = (error) => {
  const errorMsg = error.message.toLowerCase();
  
  // Connection errors
  if (errorMsg.includes('connect') || errorMsg.includes('econnrefused')) {
    return {
      success: false,
      error: 'Database connection failed.',
      suggestion: 'Please try again. If issue persists, contact support.',
      retryable: true
    };
  }
  
  // Duplicate key error
  if (error.code === 11000) {
    return {
      success: false,
      error: 'Duplicate entry detected.',
      suggestion: 'This record already exists.',
      retryable: false
    };
  }
  
  // Validation error
  if (error.name === 'ValidationError') {
    return {
      success: false,
      error: 'Invalid data provided.',
      details: Object.values(error.errors).map(e => e.message),
      retryable: false
    };
  }
  
  // Generic DB error
  return {
    success: false,
    error: 'Database operation failed.',
    suggestion: 'Please try again.',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    retryable: true
  };
};

// Send error response
export const sendErrorResponse = (res, error, statusCode = 500) => {
  // If it's our custom error
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message
    });
  }
  
  // Generic error
  return res.status(statusCode).json({
    success: false,
    error: error.error || 'An error occurred',
    suggestion: error.suggestion,
    details: error.details,
    retryable: error.retryable
  });
};
