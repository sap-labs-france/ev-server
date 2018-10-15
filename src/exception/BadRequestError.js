class BadRequestError extends Error {
    constructor(schemaErrors) {
        super("Invalid content");
        this.schemaErrors = schemaErrors;
    }
}

module.exports = BadRequestError;
