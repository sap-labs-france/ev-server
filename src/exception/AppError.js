
class AppError extends Error {
	constructor(source, message, errorCode=500, module="N/A", method="N/A", user, actionOnUser) {
		super(message);
		this.errorCode = errorCode;
		this.module = module;
		this.method = method;
		this.source = source;
		this.user = user;
		this.actionOnUser = actionOnUser;
	}
}

module.exports = AppError;
