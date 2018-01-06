const AuthService = require('./service/AuthService');
const UtilsService = require('./service/UtilsService');

require('source-map-support').install();

module.exports = {
	// Init Passport
	initialize() {
		return AuthService.initialize();
	},

	authenticate() {
		return AuthService.authenticate();
	},

	authService(req, res, next) {
		// Parse the action
		var action = /^\/\w*/g.exec(req.url)[0].substring(1);
		// Check Context
		switch (req.method) {
			// Create Request
			case "POST":
				// Action
				switch (action) {
					// Login
					case "login":
						// Delegate
						AuthService.handleLogIn(action, req, res, next);
						break;

					// Register User
					case "registeruser":
						// Delegate
						AuthService.handleRegisterUser(action, req, res, next);
						break;

					// Reset password
					case "reset":
						// Delegate
						AuthService.handleUserPasswordReset(action, req, res, next);
						break;

					default:
						// Delegate
						UtilsService.handleUnknownAction(action, req, res, next);
				}
				break;

			// Create Request
			case "GET":
				// Action
				switch (action) {
					// Log out
					case "logout":
						// Delegate
						AuthService.handleUserLogOut(action, req, res, next);
						break;
					default:
						// Delegate
						UtilsService.handleUnknownAction(action, req, res, next);
				}
		}
	}
};
