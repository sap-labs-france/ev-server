
class AppError extends Error {
  constructor(message, errorCode=500) {
    super(message);
    this.errorCode = errorCode;
  }
}

module.exports = AppError;
