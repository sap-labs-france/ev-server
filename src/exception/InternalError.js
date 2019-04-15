class InternalError extends Error {
  constructor(message, detailedMessages) {
    super(message);
    this.detailedMessages = detailedMessages;
  }
}

module.exports = InternalError;
