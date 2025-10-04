// Global error handling middleware

export const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.originalUrl}`,
    suggestion: 'Please check the API endpoint and try again.'
  });
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // Log error for debugging
  console.error('❌ Global Error Handler:', err.message);
  
  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected error occurred',
    // Only show stack in development
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};
