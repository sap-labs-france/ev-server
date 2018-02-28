
class AppError extends Error {
	constructor(message, errorCode=500, module="N/A", method="N/A", user, actionOnUser) {
		super(message);
		this.errorCode = errorCode;
		this.module = module;
		this.method = method;
		this.user = user;
		this.actionOnUser = actionOnUser;
	}
}

module.exports = AppError;
