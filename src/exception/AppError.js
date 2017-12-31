
class AppError extends Error {
	constructor(message, errorCode=500, module="N/A", method="N/A") {
		super(message);
		this.errorCode = errorCode;
		this.module = module;
		this.method = method;
	}
}

module.exports = AppError;
