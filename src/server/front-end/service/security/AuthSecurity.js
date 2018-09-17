const sanitize = require('mongo-sanitize');
const Constants = require('../../../../utils/Constants');

class AuthSecurity {

	static filterIsAuthorizedRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.Action = sanitize(request.Action);
		filteredRequest.Arg1 = sanitize(request.Arg1);
		filteredRequest.Arg2 = sanitize(request.Arg2);
		filteredRequest.Arg3 = sanitize(request.Arg3);
		return filteredRequest;
	}

	static filterResetPasswordRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.email = sanitize(request.email);
		filteredRequest.captcha = sanitize(request.captcha);
		filteredRequest.hash = sanitize(request.hash);
		return filteredRequest;
	}

	static filterRegisterUserRequest(request, loggedUser) {
		let filteredRequest = {};
		// Set
		filteredRequest.name = sanitize(request.name);
		filteredRequest.firstName = sanitize(request.firstName);
		filteredRequest.email = sanitize(request.email);
		filteredRequest.password = sanitize(request.passwords.password);
		filteredRequest.captcha = sanitize(request.captcha);
		filteredRequest.acceptEula = sanitize(request.acceptEula);
		filteredRequest.status = Constants.USER_STATUS_PENDING;
		return filteredRequest;
	}

	static filterLoginRequest(request) {
		let filteredRequest = {};
		// Set
		filteredRequest.email = sanitize(request.email);
		filteredRequest.password = sanitize(request.password);
		filteredRequest.acceptEula = sanitize(request.acceptEula);
		return filteredRequest;
	}

	static filterVerifyEmailRequest(request) {
		let filteredRequest = {};
		// Set
		filteredRequest.email = sanitize(request.email);
		filteredRequest.verificationToken = sanitize(request.verificationToken);
		return filteredRequest;
	}
}

module.exports = AuthSecurity;
