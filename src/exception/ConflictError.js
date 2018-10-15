class ConflictError extends Error {
    constructor(source, message, module = "N/A", method = "N/A", user, action) {
        super(message);
        this.module = module;
        this.method = method;
        this.source = source;
        this.user = user;
        this.action = action;
    }
}

module.exports = ConflictError;
