const SecurityRestObjectFiltering = require('../SecurityRestObjectFiltering');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const Logging = require('../../../utils/Logging');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const User = require('../../../model/User');
const Users = require('../../../utils/Users');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const Authorization = require('../../../utils/Authorization');
const NotificationHandler = require('../../../notification/NotificationHandler');
const compileProfile = require('node-authorization').profileCompiler;
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const Mustache = require('mustache');
const moment = require('moment');
const https = require('https');

let _centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();

// Init JWT auth options
let jwtOptions = {
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

class AuthService {
	static initialize() {
		return passport.initialize();
	}

	static authenticate() {
		return passport.authenticate('jwt', { session: false });
	}

	static handleLogIn(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "AuthService",
			method: "handleLogIn",
			message: `User Logs In with Email '${req.body.email}'`
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterLoginRequest(req.body);
		// Check
		if (!filteredRequest.email) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The email is mandatory`), req, res, next);
			return;
		}
		if (!filteredRequest.password) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The password is mandatory`), req, res, next);
			return;
		}
		// Check email
		global.storage.getUserByEmail(filteredRequest.email).then((user) => {
			if (!user) {
				throw new AppError(`The user with email ${filteredRequest.email} does not exist`, 500,
					"AuthService", "handleLogIn");
			}
			// Check if the number of trials is reached
			if (user.getPasswordWrongNbrTrials() >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
				// Check if the user is still locked
				if (user.getStatus() === Users.USER_STATUS_LOCKED) {
					// Yes: Check date to reset pass
					if (moment(user.getPasswordBlockedUntil()).isBefore(moment())) {
						// Time elapsed: activate the account again
						Logging.logSecurityInfo({
							user: user.getModel(), module: "AuthService", method: "handleLogIn", action: action,
							message: `User '${Utils.buildUserFullName(user.getModel())}' has been unlocked and can try to login again`});
						// Reinit nbr of trial and status
						user.setPasswordWrongNbrTrials(0);
						user.setStatus(Users.USER_STATUS_ACTIVE);
						// Save
						user.save().then(() => {
							// Check user
							AuthService.checkUserLogin(action, user, filteredRequest, req, res, next);
						});
					} else {
						// Block
						Logging.logSecurityError({
							user: user.getModel(), module: "AuthService", method: "handleLogIn", action: action,
							message: `User '${Utils.buildUserFullName(user.getModel())}' tried to login too many times: account is locked`});
						// Return data
						res.status(450).send({"message": Utils.hideShowMessage("User is locked: too many attempts")});
						next();
					}
				} else {
					// An admin has reactivated the account
					user.setPasswordWrongNbrTrials(0);
					// Check user
					AuthService.checkUserLogin(action, user, filteredRequest, req, res, next);
				}
			} else {
				// Nbr trials OK: Check user
				AuthService.checkUserLogin(action, user, filteredRequest, req, res, next);
			}
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleRegisterUser(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "AuthService",
			method: "handleRegisterUser",
			message: `User Registers in with Email '${req.body.email}'`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterRegisterUserRequest(req.body);
		// Check
		if (!filteredRequest.captcha) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The captcha is mandatory`), req, res, next);
			return;
		}
		// Check captcha
		https.get({
			"host": "www.google.com",
			"method": "GET",
			"path": `/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`
		}, (responseGoogle) => {
			// Gather data
			responseGoogle.on('data', (responseGoogleData) => {
				// Check
				let responseGoogleDataJSon = JSON.parse(responseGoogleData);
				if (!responseGoogleDataJSon.success) {
					Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The captcha is invalid`), req, res, next);
					return;
				}
				// Check Mandatory fields
				if (Users.checkIfUserValid("RegisterUser", filteredRequest, req, res, next)) {
					// Check email
					global.storage.getUserByEmail(filteredRequest.email).then((user) => {
						if (user) {
							throw new AppError(`The email ${filteredRequest.email} already exists`, 510,
								"AuthService", "handleRegisterUser");
						}
						// Generate a password
						return Users.hashPasswordBcrypt(filteredRequest.password);
					}).then((newPasswordHashed) => {
						// Create the user
						let newUser = new User(filteredRequest);
						// Set data
						newUser.setStatus(Users.USER_STATUS_PENDING);
						newUser.setRole(Users.USER_ROLE_BASIC);
						newUser.setPassword(newPasswordHashed);
						newUser.setCreatedBy("System");
						newUser.setCreatedOn(new Date());
						// Save
						return newUser.save();
					}).then((newUser) => {
						Logging.logSecurityInfo({
							user: req.user, action: action,
							module: "AuthService",
							method: "handleRegisterUser",
							message: `User with Email '${req.body.email}' has been created successfully`,
							detailedMessages: req.body
						});
						// Send notification
						NotificationHandler.sendNewRegisteredUser(
							Utils.generateGUID(),
							newUser.getModel(),
							{
								"user": newUser.getModel(),
								"evseDashboardURL" : Utils.buildEvseURL()
							},
							req.locale);
						// Ok
						res.json({status: `Success`});
						next();
					}).catch((err) => {
						// Log
						Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
					});
				}
			});
		}).on("error", (err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleUserPasswordReset(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "AuthService",
			method: "handleUserPasswordReset",
			message: `User Password Reset with Email '${req.body.email}'`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = SecurityRestObjectFiltering.filterResetPasswordRequest(req.body);
		// Check hash
		if (!filteredRequest.hash) {
			// No hash: Send email with init pass hash link
			if (!filteredRequest.captcha) {
				Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The captcha is mandatory`), req, res, next);
				return;
			}
			// Check captcha
			https.get({
				"host": "www.google.com",
				"method": "GET",
				"path": `/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`
			}, (responseGoogle) => {
				// Gather data
				responseGoogle.on('data', (responseGoogleData) => {
					// Check
					let responseGoogleDataJSon = JSON.parse(responseGoogleData);
					if (!responseGoogleDataJSon.success) {
						Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The captcha is invalid`), req, res, next);
						return;
					}
					// Yes: Generate new password
					let resetHash = Utils.generateGUID();
					// Generate a new password
					global.storage.getUserByEmail(filteredRequest.email).then((user) => {
						// Found?
						if (!user) {
							throw new AppError(`User with email ${filteredRequest.email} does not exist`, 545,
								"AuthService", "handleUserPasswordReset");
						}
						// Hash it
						user.setPasswordResetHash(resetHash);
						// Save the user
						return user.save();
					}).then((savedUser) => {
						Logging.logSecurityInfo({
							user: req.user, action: action,
							module: "AuthService",
							method: "handleUserPasswordReset",
							message: `User with Email '${req.body.email}' will receive an email to reset his password`
						});
						// Send notification
						NotificationHandler.sendResetPassword(
							Utils.generateGUID(),
							savedUser.getModel(),
							{
								"user": savedUser.getModel(),
								"hash": resetHash,
								"email": savedUser.getEMail(),
								"evseDashboardURL" : Utils.buildEvseURL()
							},
							req.locale);
						// Ok
						res.json({status: `Success`});
						next();
					}).catch((err) => {
						// Log exception
						Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
					});
				});
			}).on("error", (err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		} else {
			// Create the password
			let newPassword = Users.generatePassword();
			let newHashedPassword;
			// Hash it
			Users.hashPasswordBcrypt(newPassword).then((hashedPassword) => {
				// Set
				newHashedPassword = hashedPassword;
				// Get the user
				return global.storage.getUserByEmail(filteredRequest.email);
			}).then((user) => {
				// Found?
				if (!user) {
					throw new AppError(`User with email ${filteredRequest.email} does not exist`, 545,
						"AuthService", "handleUserPasswordReset");
				}
				// Check the hash from the db
				if (!user.getPasswordResetHash() || filteredRequest.hash !== user.getPasswordResetHash()) {
					throw new AppError(`The user's hash '${user.getPasswordResetHash()}' do not match`, 535,
						"AuthService", "handleUserPasswordReset");
				}
				// Set the hashed password
				user.setPassword(newHashedPassword);
				// Reset the hash
				user.setPasswordResetHash(null);
				// Save the user
				return user.save();
			}).then((newUser) => {
				Logging.logSecurityInfo({
					user: req.user, action: action,
					module: "AuthService",
					method: "handleUserPasswordReset",
					message: `User with Email '${req.body.email}' have had his password reset successfully`,
					detailedMessages: req.body
				});
				// Send notification
				NotificationHandler.sendResetPassword(
					Utils.generateGUID(),
					newUser.getModel(),
					{
						"user": newUser.getModel(),
						"hash": null,
						"newPassword": newPassword,
						"evseDashboardURL" : Utils.buildEvseURL()
					},
					req.locale);
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log exception
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleUserLogOut(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "AuthService",
			method: "handleUserLogOut",
			message: `User with Email '${req.body.email}' just logged out`,
			detailedMessages: req.body
		});
		req.logout();
		res.status(200).send({});
	}

	static checkUserLogin(action, user, filteredRequest, req, res, next) {
		// User Found?
		if (user) {
			// Check if the account is active
			if (user.getStatus() !== Users.USER_STATUS_ACTIVE) {
				Logging.logActionExceptionMessageAndSendResponse(action, new Error(`Your account ${user.getEMail()} is not yet active`), req, res, next, 550);
				return;
			}
			// Check password
			Users.checkPasswordBCrypt(filteredRequest.password, user.getPassword()).then((match) => {
				// Check new and old version of hashing the password
				if (match || (user.getPassword() === Users.hashPassword(filteredRequest.password))) {
					// Password OK
					// Reset wrong number of trial
					user.setPasswordWrongNbrTrials(0);
					// Save
					user.save();
					// Log it
					Logging.logSecurityInfo({
						user: user.getModel(), module: "AuthService", method: "checkUserLogin", action: action,
						message: `User '${Utils.buildUserFullName(user.getModel())}' logged in successfully`});
					// Get authorisation
					let userRole = Authorization.getAuthorizationFromRoleID(user.getRole());
					// Parse the auth and replace values
					let parsedAuths = Mustache.render(JSON.stringify(userRole.auths), {"user": user.getModel()});
					// Compile auths of the role
					let compiledAuths = compileProfile(JSON.parse(parsedAuths));
					// Yes: build payload
					let payload = {
							id: user.getID(),
							role: user.getRole(),
							name: user.getName(),
							firstName: user.getFirstName(),
							auths: compiledAuths
					};
					// Build token
					let token;
					// Role Demo?
					if (CentralRestServerAuthorization.isDemo(user.getModel()) ||
							CentralRestServerAuthorization.isCorporate(user.getModel())) {
						// Yes
						token = jwt.sign(payload, jwtOptions.secretOrKey, {
							expiresIn: _centralSystemRestConfig.userDemoTokenLifetimeDays * 24 * 3600
						});
					} else {
						// No
						token = jwt.sign(payload, jwtOptions.secretOrKey, {
							expiresIn: _centralSystemRestConfig.userTokenLifetimeHours * 3600
						});
					}
					// Return it
					res.json({ token: token });
				} else {
					// Wrong Password
					// Add wrong trial + 1
					user.setPasswordWrongNbrTrials(user.getPasswordWrongNbrTrials() + 1);
					// Check if the number of trial is reached
					if (user.getPasswordWrongNbrTrials() >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
						// Too many attempts, lock user
						// Log it
						Logging.logSecurityError({
							module: "AuthService", method: "checkUserLogin", action: action,
							message: `User '${Utils.buildUserFullName(user.getModel())}' is locked for ${_centralSystemRestConfig.passwordBlockedWaitTimeMin} mins: too many failed attempts (${_centralSystemRestConfig.passwordWrongNumberOfTrial})`});
						// User locked
						user.setStatus(Users.USER_STATUS_LOCKED);
						// Set blocking date
						user.setPasswordBlockedUntil(
							moment().add(_centralSystemRestConfig.passwordBlockedWaitTimeMin, "m").toDate()
						);
						// Save nbr of trials
						user.save().then(() => {
							// Account locked
							res.status(450).send({"message": Utils.hideShowMessage("User is locked: too many attempt")});
							next();
						});
					} else {
						// Wrong logon
						// Log it
						Logging.logSecurityError({
							module: "AuthService", method: "checkUserLogin", action: action,
							message: `User '${Utils.buildUserFullName(user.getModel())}' tried to log in without success, ${_centralSystemRestConfig.passwordWrongNumberOfTrial - user.getPasswordWrongNbrTrials()} trial(s) remaining`});
						// Not authorized
						user.save().then(() => {
							// Unauthorized
							res.sendStatus(401);
							next();
						});
					}
				}
			});
		} else {
			// User not Found!
			// Log it
			Logging.logSecurityError({
				module: "AuthService", method: "checkUserLogin", action: action,
				message: `Unknown user tried to log in with email '${filteredRequest.email}'`});
			// User not found
			res.sendStatus(401);
			next();
		}
	}
}

module.exports = AuthService;
