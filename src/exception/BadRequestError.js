class BadRequestError extends Error {
  constructor(errorDetails) {
    super("Invalid content");
    this.details = errorDetails;
  }
}

module.exports = BadRequestError;
