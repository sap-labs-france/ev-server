class ConflictError extends Error {
    constructor(message, messageKey, messageParams) {
        super(message);
        this.messageKey = messageKey;
        this.messageParams = messageParams;
    }
}

module.exports = ConflictError;
