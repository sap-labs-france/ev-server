class BackendError extends Error {
  constructor(source, message, module = "N/A", method = "N/A", action = "N/A") {
    super(message);
    this.source = source;
    this.module = module;
    this.method = method;
    this.action = action;
  }
}

module.exports = BackendError;
