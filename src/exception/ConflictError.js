class ConflictError extends Error {
    constructor(source, message, messageKey, messageParams, module = "N/A", method = "N/A", user, action) {
        super(message);
        this.messageKey = messageKey;
        this.messageParams = messageParams;
        this.module = module;
        this.method = method;
        this.source = source;
        this.user = user;
        this.action = action;
    }
}

module.exports = ConflictError;
