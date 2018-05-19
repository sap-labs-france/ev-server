const sanitize = require('mongo-sanitize');
const Utils = require('../../../../utils/Utils');
const Users = require('../../../../utils/Users');
const UtilsSecurity = require('./UtilsSecurity');

class AuthSecurity {
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
		filteredRequest.status = Users.USER_STATUS_PENDING;
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
}

module.exports = AuthSecurity;
