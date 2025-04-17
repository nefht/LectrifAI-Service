const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Check status code
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  res.status(statusCode).json({
    success: false,
    message: message,
  });
};

module.exports = errorHandler;