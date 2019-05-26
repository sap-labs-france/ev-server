class BadRequestError extends Error {
  constructor(errorDetails) {
    super(errorDetails && errorDetails.message ? errorDetails.message : 'Invalid request payload');
    this.details = errorDetails;
  }
}

module.exports = BadRequestError;
