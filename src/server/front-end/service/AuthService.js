const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const moment = require('moment');
const axios = require('axios');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const User = require('../../../model/User');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const Authorizations = require('../../../authorization/Authorizations');
const NotificationHandler = require('../../../notification/NotificationHandler');
const AuthSecurity = require('./security/AuthSecurity');
const ChargingStationStorage = require('../../../storage/mongodb/ChargingStationStorage'); 
const TransactionStorage = require('../../../storage/mongodb/TransactionStorage');
const UserStorage = require('../../../storage/mongodb/UserStorage');

let _centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
let jwtOptions;

// Init JWT auth options
if (_centralSystemRestConfig) {
	// Set
	jwtOptions = {
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
}

class AuthService {
	static initialize() {
		return passport.initialize();
	}

	static authenticate() {
		return passport.authenticate('jwt', { session: false });
	}

	static async handleIsAuthorized(action, req, res, next) {
		try {
			// Default
			let result = {'IsAuthorized' : false};
			// Filter
			let filteredRequest = AuthSecurity.filterIsAuthorizedRequest(req.query);
			// Check
			if (!filteredRequest.Action) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Action is mandatory`,
					550, 'AuthService', 'handleIsAuthorized');
			}
			// Action
			switch (filteredRequest.Action) {
				// Action on charger
				case 'StopTransaction':
					// Check
					if (!filteredRequest.Arg1) {
						throw new AppError(
							Constants.CENTRAL_SERVER,
							`The Charging Station ID is mandatory`,
							550, 'AuthService', 'handleIsAuthorized');
					}
					// Check
					if (!filteredRequest.Arg2) {
						throw new AppError(
							Constants.CENTRAL_SERVER,
							`The Transaction ID is mandatory`,
							550, 'AuthService', 'handleIsAuthorized');
					}
					// Get the Charging station
					let chargingStation = await ChargingStationStorage.getChargingStation(filteredRequest.Arg1);
					// Found?
					if (!chargingStation) {
						// Not Found!
						throw new AppError(
							Constants.CENTRAL_SERVER,
							`Charging Station with ID '${filteredRequest.Arg1}' does not exist`,
							550, 'AuthService', 'handleIsAuthorized');
					}
					// Get Transaction
					let transaction = await TransactionStorage.getTransaction(filteredRequest.Arg2);
					if (!transaction) {
						throw new AppError(
							Constants.CENTRAL_SERVER,
							`Transaction with ID '${filteredRequest.Arg2}' does not exist`,
							560, 'ChargingStationService', 'handleAction');
					}
					try {
						// Check
						await Authorizations.checkAndGetIfUserIsAuthorizedForChargingStation(
							filteredRequest.Action, chargingStation, transaction.tagID, req.user.tagIDs[0]);
						// Ok
						result.IsAuthorized = true;
					} catch (e) {
						// Ko
						result.IsAuthorized = false;
					}
					break;
			}
			// Return the result
			res.json(result);
			next();
		} catch(err) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		}
	}

	static async handleLogIn(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = AuthSecurity.filterLoginRequest(req.body);
			// Check
			if (!filteredRequest.email) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Email is mandatory`, 500, 
					'AuthService', 'handleLogIn');
			}
			if (!filteredRequest.password) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Password is mandatory`, 500, 
					'AuthService', 'handleLogIn');
			}
			if (!filteredRequest.acceptEula) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The End-user License Agreement is mandatory`, 520, 
					'AuthService', 'handleLogIn');
			}
			// Check email
			let user = await UserStorage.getUserByEmail(filteredRequest.email);
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with email '${filteredRequest.email}' does not exist`, 550, 
					'AuthService', 'handleLogIn');
			}
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with email '${filteredRequest.email}' is logically deleted`, 550, 
					'AuthService', 'handleLogIn');
			}
			// Check if the number of trials is reached
			if (user.getPasswordWrongNbrTrials() >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
				// Check if the user is still locked
				if (user.getStatus() === Constants.USER_STATUS_LOCKED) {
					// Yes: Check date to reset pass
					if (moment(user.getPasswordBlockedUntil()).isBefore(moment())) {
						// Time elapsed: activate the account again
						Logging.logSecurityInfo({
							actionOnUser: user.getModel(),
							module: 'AuthService', method: 'handleLogIn', action: action,
							message: `User has been unlocked and can try to login again`});
						// Reinit nbr of trial and status
						user.setPasswordWrongNbrTrials(0);
						user.setPasswordBlockedUntil(null);
						user.setStatus(Constants.USER_STATUS_ACTIVE);
						// Save
						await user.save();
						// Check user
						await AuthService.checkUserLogin(action, user, filteredRequest, req, res, next);
					} else {
						// Return data
						throw new AppError(
							Constants.CENTRAL_SERVER,	`User is locked`,
							570, 'AuthService', 'handleLogIn',
							user.getModel());
					}
				} else {
					// An admin has reactivated the account
					user.setPasswordWrongNbrTrials(0);
					user.setPasswordBlockedUntil(null);
					// Check user
					await AuthService.checkUserLogin(action, user, filteredRequest, req, res, next);
				}
			} else {
				// Nbr trials OK: Check user
				await AuthService.checkUserLogin(action, user, filteredRequest, req, res, next);
			}
		} catch(err) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		}
	}

	static async handleRegisterUser(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = AuthSecurity.filterRegisterUserRequest(req.body);
			// Check EULA
			if (!filteredRequest.acceptEula) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The End-user License Agreement is mandatory`,
					520, 'AuthService', 'handleLogIn');
			}
			// Check
			if (!filteredRequest.captcha) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The captcha is mandatory`, 500, 
					'AuthService', 'handleRegisterUser');
			}
			// Check captcha
			let response = await axios.get(
				`https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
			// Check
			if (!response.data.success) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The captcha is invalid`, 500, 
					'AuthService', 'handleRegisterUser');
			}
			// Check email
			let user = await UserStorage.getUserByEmail(filteredRequest.email);
			// Check Mandatory fields
			User.checkIfUserValid(filteredRequest, req);
			if (user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Email already exists`, 510, 
					'AuthService', 'handleRegisterUser',
					null, user.getModel());
			}
			// Generate a password
			let newPasswordHashed = await User.hashPasswordBcrypt(filteredRequest.password);
			// Create the user
			let newUser = new User(filteredRequest);
			// Set data
			newUser.setStatus(Constants.USER_STATUS_PENDING);
			newUser.setRole(Constants.ROLE_BASIC);
			newUser.setPassword(newPasswordHashed);
			newUser.setLocale(req.locale.substring(0,5));
			newUser.setCreatedOn(new Date());
			// Get EULA
			let endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(newUser.getLanguage());
			// Set Eula Info on Login Only
			newUser.setEulaAcceptedOn(new Date());
			newUser.setEulaAcceptedVersion(endUserLicenseAgreement.version);
			newUser.setEulaAcceptedHash(endUserLicenseAgreement.hash);
			// Save
			newUser = await newUser.save();
			// Log
			Logging.logSecurityInfo({
				user: req.user, action: action,
				module: 'AuthService',
				method: 'handleRegisterUser',
				message: `User with Email '${req.body.email}' has been created successfully`,
				detailedMessages: req.body
			});
			// Send notification
			NotificationHandler.sendNewRegisteredUser(
				Utils.generateGUID(),
				newUser.getModel(),
				{
					'user': newUser.getModel(),
					'evseDashboardURL' : Utils.buildEvseURL()
				},
				newUser.getLocale()
			);
			// Ok
			res.json({status: `Success`});
			next();
		} catch(err) {	
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		}
	}

	static async checkAndSendResetPasswordConfirmationEmail(filteredRequest, action, req, res, next) {
		try {
			// No hash: Send email with init pass hash link
			if (!filteredRequest.captcha) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The captcha is mandatory`, 500, 
					'AuthService', 'handleUserPasswordReset');
			}
			// Check captcha
			let response = await axios.get(
				`https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
			// Check
			if (!response.data.success) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The captcha is invalid`, 500, 
					'AuthService', 'handleRegisterUser');
			}
			// Yes: Generate new password
			let resetHash = Utils.generateGUID();
			// Generate a new password
			let user = await UserStorage.getUserByEmail(filteredRequest.email);
			// Found?
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`User with email '${filteredRequest.email}' does not exist`, 550, 
					'AuthService', 'handleUserPasswordReset');
			}
			// Deleted
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`User with email '${filteredRequest.email}' is logically deleted`, 550, 
					'AuthService', 'handleUserPasswordReset');
			}
			// Hash it
			user.setPasswordResetHash(resetHash);
			// Save the user
			let savedUser = await user.save();
			// Log
			Logging.logSecurityInfo({
				user: req.user, action: action,
				module: 'AuthService',
				method: 'handleUserPasswordReset',
				message: `User with Email '${req.body.email}' will receive an email to reset his password`
			});
			// Send notification
			let evseDashboardResetPassURL = Utils.buildEvseURL() +
				'/#/reset-password?hash=' + resetHash + '&email=' +
				savedUser.getEMail();
			// Send email
			NotificationHandler.sendRequestPassword(
				Utils.generateGUID(),
				savedUser.getModel(),
				{
					'user': savedUser.getModel(),
					'evseDashboardURL' : Utils.buildEvseURL(),
					'evseDashboardResetPassURL' : evseDashboardResetPassURL
				},
				savedUser.getLocale()
			);
			// Ok
			res.json({status: `Success`});
			next();
		} catch(err) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		}
	}

	static async generateNewPasswordAndSendEmail(filteredRequest, action, req, res, next) {
		try {
			// Create the password
			let newPassword = User.generatePassword();
			// Hash it
			let newHashedPassword = await User.hashPasswordBcrypt(newPassword);
			// Get the user
			let user = await UserStorage.getUserByEmail(filteredRequest.email);
			// Found?
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`User with email '${filteredRequest.email}' does not exist`,
					550, 'AuthService', 'handleUserPasswordReset');
			}
			// Deleted
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`User with email '${filteredRequest.email}' is logically deleted`,
					550, 'AuthService', 'handleUserPasswordReset');
			}
			// Check the hash from the db
			if (!user.getPasswordResetHash()) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user has already reset his password`,
					540, 'AuthService', 'handleUserPasswordReset',
					user.getModel());
			}
			// Check the hash from the db
			if (filteredRequest.hash !== user.getPasswordResetHash()) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user's hash '${user.getPasswordResetHash()}' do not match the requested one '${filteredRequest.hash}'`,
					540, 'AuthService', 'handleUserPasswordReset',
					user.getModel());
			}
			// Set the hashed password
			user.setPassword(newHashedPassword);
			// Reset the hash
			user.setPasswordResetHash(null);
			// Save the user
			let newUser = await user.save();
			// Log
			Logging.logSecurityInfo({
				user: req.user, action: action,
				module: 'AuthService',
				method: 'handleUserPasswordReset',
				message: `User's password has been reset successfully`,
				detailedMessages: req.body
			});
			// Send notification
			NotificationHandler.sendNewPassword(
				Utils.generateGUID(),
				newUser.getModel(),
				{
					'user': newUser.getModel(),
					'hash': null,
					'newPassword': newPassword,
					'evseDashboardURL' : Utils.buildEvseURL()
				},
				newUser.getLocale()
			);
			// Ok
			res.json({status: `Success`});
			next();
		} catch(err) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		}
	}

	static async handleUserPasswordReset(action, req, res, next) {
		// Filter
		let filteredRequest = AuthSecurity.filterResetPasswordRequest(req.body);
		// Check hash
		if (!filteredRequest.hash) {
			// Send Confirmation Email for requesting a new password
			await AuthService.checkAndSendResetPasswordConfirmationEmail(filteredRequest, action, req, res, next);
		} else {
			// Send the new password
			await AuthService.generateNewPasswordAndSendEmail(filteredRequest, action, req, res, next);
		}
	}

	static handleUserLogOut(action, req, res, next) {
		req.logout();
		res.status(200).send({});
	}

	static async userLoginWrongPassword(action, user, req, res, next) {
		// Add wrong trial + 1
		user.setPasswordWrongNbrTrials(user.getPasswordWrongNbrTrials() + 1);
		// Check if the number of trial is reached
		if (user.getPasswordWrongNbrTrials() >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
			// Too many attempts, lock user
			// User locked
			user.setStatus(Constants.USER_STATUS_LOCKED);
			// Set blocking date
			user.setPasswordBlockedUntil(
				moment().add(_centralSystemRestConfig.passwordBlockedWaitTimeMin, 'm').toDate()
			);
			// Save nbr of trials
			await user.save();
			// Log
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`User is locked`, 570, 'AuthService', 'checkUserLogin',
				user.getModel()
			);
		} else {
			// Wrong logon
			await user.save();
			// Log
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`User failed to log in, ${_centralSystemRestConfig.passwordWrongNumberOfTrial - user.getPasswordWrongNbrTrials()} trial(s) remaining`,
				401, 'AuthService', 'checkUserLogin',
				user.getModel()
			);
		}
	}

	static async userLoginSucceeded(action, user, req, res, next) {
		// Password / Login OK
		Logging.logSecurityInfo({
			user: user.getModel(),
			module: 'AuthService', method: 'checkUserLogin',
			action: action, message: `User logged in successfully`});
		// Get EULA
		let endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(user.getLanguage());
		// Set Eula Info on Login Only
		if (action == 'Login') {
			user.setEulaAcceptedOn(new Date());
			user.setEulaAcceptedVersion(endUserLicenseAgreement.version);
			user.setEulaAcceptedHash(endUserLicenseAgreement.hash);
		}
		// Reset wrong number of trial
		user.setPasswordWrongNbrTrials(0);
		user.setPasswordBlockedUntil(null);
		user.setPasswordResetHash(null);
		// Save
		await user.save();
		// Build Authorization
		let auths = await Authorizations.buildAuthorizations(user);
		// Yes: build payload
		let payload = {
			'id': user.getID(),
			'role': user.getRole(),
			'name': user.getName(),
			'tagIDs': user.getTagIDs(),
			'firstName': user.getFirstName(),
			'locale': user.getLocale(),
			'language': user.getLanguage(),
			'auths': auths
		};
		// Build token
		let token;
		// Role Demo?
		if (Authorizations.isDemo(user.getModel())) {
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
	}

	static async checkUserLogin(action, user, filteredRequest, req, res, next) {
		// User Found?
		if (!user) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Unknown user tried to log in with email '${filteredRequest.email}'`,
				401, 'AuthService', 'checkUserLogin',
				user.getModel());
		}
		// Check if the account is active
		if (user.getStatus() !== Constants.USER_STATUS_ACTIVE) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`Account is not active`, 580, 
				'AuthService', 'checkUserLogin',
				user.getModel());
		}
		// Check password
		let match = await User.checkPasswordBCrypt(filteredRequest.password, user.getPassword());
		// Check new and old version of hashing the password
		if (match || (user.getPassword() === User.hashPassword(filteredRequest.password))) {
			// Login OK
			await AuthService.userLoginSucceeded(action, user, req, res, next);
		} else {
			// Login KO
			await AuthService.userLoginWrongPassword(action, user, req, res, next);
		}
	}
}
module.exports = AuthService;
