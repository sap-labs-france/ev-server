const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const Users = require('../../utils/Users');
const NotificationHandler = require('../../notification/NotificationHandler');
const Logging = require('../../utils/Logging');
const User = require('../../model/User');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');
const Configuration = require('../../utils/Configuration');
const Authorization = require('../../utils/Authorization');
const compileProfile = require('node-authorization').profileCompiler;
const Mustache = require('mustache');
const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');
const SecurityRestObjectFiltering = require('./SecurityRestObjectFiltering');
const moment = require('moment');
const https = require('https');
const AuthService = require('./service/AuthService');
const UtilsService = require('./service/UtilsService');

require('source-map-support').install();

let _centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();

// Init JWT auth options
var jwtOptions = {
	jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
	secretOrKey: _centralSystemRestConfig.userTokenKey
	// issuer: 'evse-dashboard',
	// audience: 'evse-dashboard'
};

// Use
passport.use(new JwtStrategy(jwtOptions, (jwtPayload, done) => {
	// Return the token decoded right away
	return done(null, jwtPayload);
}));

module.exports = {
	// Init Passport
	initialize() {
		return passport.initialize();
	},

	authenticate() {
		return passport.authenticate('jwt', { session: false });
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
