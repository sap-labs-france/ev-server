class BadRequestError extends Error {
    constructor(source, message, schemaErrors, module = "N/A", method = "N/A") {
        super(message);
        this.module = module;
        this.method = method;
        this.source = source;
        this.schemaErrors = schemaErrors;
    }
}

module.exports = BadRequestError;
