class BackendError extends Error {
  constructor(source, message, module = "N/A", method = "N/A", action = "N/A", user, actionOnUser) {
    super(message);
    this.source = source;
    this.module = module;
    this.method = method;
    this.action = action;
    this.user = user;
    this.actionOnUser = actionOnUser;
  }
}

module.exports = BackendError;
