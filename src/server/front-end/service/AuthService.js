const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const User = require('../../../model/User');
const Users = require('../../../utils/Users');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const Authorizations = require('../../../utils/Authorizations');
const NotificationHandler = require('../../../notification/NotificationHandler');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const compileProfile = require('node-authorization').profileCompiler;
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const Mustache = require('mustache');
const moment = require('moment');
const https = require('https');
const AuthSecurity = require('./security/AuthSecurity');

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
		// Filter
		let filteredRequest = AuthSecurity.filterLoginRequest(req.body);
		// Check
		if (!filteredRequest.email) {
			Logging.logActionExceptionMessageAndSendResponse(action,
				new AppError(
					Constants.CENTRAL_SERVER,
					`The email is mandatory`,
					500, "AuthService", "handleLogIn"), req, res, next);
			return;
		}
		if (!filteredRequest.password) {
			Logging.logActionExceptionMessageAndSendResponse(action,
				new AppError(
					Constants.CENTRAL_SERVER,
					`The password is mandatory`,
					500, "AuthService", "handleLogIn"), req, res, next);
			return;
		}
		if (!filteredRequest.acceptEula) {
			Logging.logActionExceptionMessageAndSendResponse(action,
				new AppError(
					Constants.CENTRAL_SERVER,
					`The End-user License Agreement is mandatory`,
					520, "AuthService", "handleLogIn"),
				req, res, next);
			return;
		}
		// Check email
		global.storage.getUserByEmail(filteredRequest.email).then((user) => {
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with email '${filteredRequest.email}' does not exist`,
					550, "AuthService", "handleLogIn");
			}
			// Check if the number of trials is reached
			if (user.getPasswordWrongNbrTrials() >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
				// Check if the user is still locked
				if (user.getStatus() === Users.USER_STATUS_LOCKED) {
					// Yes: Check date to reset pass
					if (moment(user.getPasswordBlockedUntil()).isBefore(moment())) {
						// Time elapsed: activate the account again
						Logging.logSecurityInfo({
							actionOnUser: user.getModel(),
							module: "AuthService", method: "handleLogIn", action: action,
							message: `User has been unlocked and can try to login again`});
						// Reinit nbr of trial and status
						user.setPasswordWrongNbrTrials(0);
						user.setStatus(Users.USER_STATUS_ACTIVE);
						// Save
						user.save().then(() => {
							// Check user
							AuthService.checkUserLogin(action, user, filteredRequest, req, res, next);
						});
					} else {
						// Return data
						throw new AppError(
							Constants.CENTRAL_SERVER,
							`User is locked`,
							570, "AuthService", "handleLogIn",
							user.getModel());
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
		// Filter
		let filteredRequest = AuthSecurity.filterRegisterUserRequest(req.body);
		// Check
		if (!filteredRequest.captcha) {
			Logging.logActionExceptionMessageAndSendResponse(action,
				new AppError(
					Constants.CENTRAL_SERVER,
					`The captcha is mandatory`,
					500, "AuthService", "handleRegisterUser"), req, res, next);
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
					Logging.logActionExceptionMessageAndSendResponse(action,
						new AppError(
							Constants.CENTRAL_SERVER,
							`The captcha is invalid`,
							500, "AuthService", "handleRegisterUser"), req, res, next);
					return;
				}
				// Check email
				global.storage.getUserByEmail(filteredRequest.email).then((user) => {
					// Check Mandatory fields
					Users.checkIfUserValid(filteredRequest, req);
					if (user) {
						throw new AppError(
							Constants.CENTRAL_SERVER,
							`Email already exists`,
							510, "AuthService", "handleRegisterUser",
							null, user.getModel());
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
					newUser.setLocale(req.locale.substring(0,5));
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
						newUser.getLocale());
					// Ok
					res.json({status: `Success`});
					next();
				}).catch((err) => {
					// Log
					Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
				});
			});
		}).on("error", (err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleUserPasswordReset(action, req, res, next) {
		// Filter
		let filteredRequest = AuthSecurity.filterResetPasswordRequest(req.body);
		// Check hash
		if (!filteredRequest.hash) {
			// No hash: Send email with init pass hash link
			if (!filteredRequest.captcha) {
				Logging.logActionExceptionMessageAndSendResponse(action,
					new AppError(
						Constants.CENTRAL_SERVER,
						`The captcha is mandatory`,
						500, "AuthService", "handleUserPasswordReset"), req, res, next);
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
						Logging.logActionExceptionMessageAndSendResponse(action,
							new AppError(
								Constants.CENTRAL_SERVER,
								`The captcha is invalid`,
								500, "AuthService", "handleUserPasswordReset"), req, res, next);
						return;
					}
					// Yes: Generate new password
					let resetHash = Utils.generateGUID();
					// Generate a new password
					global.storage.getUserByEmail(filteredRequest.email).then((user) => {
						// Found?
						if (!user) {
							throw new AppError(
								Constants.CENTRAL_SERVER,
								`User with email '${filteredRequest.email}' does not exist`,
								550, "AuthService", "handleUserPasswordReset");
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
						let evseDashboardResetPassURL = Utils.buildEvseURL() +
							'/#/reset-password?hash=' + resetHash + '&email=' +
							savedUser.getEMail();
						NotificationHandler.sendRequestPassword(
							Utils.generateGUID(),
							savedUser.getModel(),
							{
								"user": savedUser.getModel(),
								"evseDashboardURL" : Utils.buildEvseURL(),
								"evseDashboardResetPassURL" : evseDashboardResetPassURL
							},
							savedUser.getLocale());
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
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`User with email '${filteredRequest.email}' does not exist`,
						550, "AuthService", "handleUserPasswordReset");
				}
				// Check the hash from the db
				if (!user.getPasswordResetHash()) {
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The user has already reset his password`,
						540, "AuthService", "handleUserPasswordReset",
						user.getModel());
				}
				// Check the hash from the db
				if (filteredRequest.hash !== user.getPasswordResetHash()) {
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The user's hash '${user.getPasswordResetHash()}' do not match the requested one '${filteredRequest.hash}'`,
						540, "AuthService", "handleUserPasswordReset",
						user.getModel());
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
					message: `User's password has been reset successfully`,
					detailedMessages: req.body
				});
				// Send notification
				NotificationHandler.sendNewPassword(
					Utils.generateGUID(),
					newUser.getModel(),
					{
						"user": newUser.getModel(),
						"hash": null,
						"newPassword": newPassword,
						"evseDashboardURL" : Utils.buildEvseURL()
					},
					newUser.getLocale());
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
			message: `User logged out`,
			detailedMessages: req.body
		});
		req.logout();
		res.status(200).send({});
	}

	static checkUserLogin(action, user, filteredRequest, req, res, next) {
		// User Found?
		if (!user) {
			// User not Found!
			Logging.logActionExceptionMessageAndSendResponse(
				action,
				new AppError(
					Constants.CENTRAL_SERVER,
					`Unknown user tried to log in with email '${filteredRequest.email}'`,
					401, "AuthService", "checkUserLogin",
					user.getModel()),
				req, res, next);
		}
		// Check if the account is active
		if (user.getStatus() !== Users.USER_STATUS_ACTIVE) {
			Logging.logActionExceptionMessageAndSendResponse(
				action,
				new AppError(
					Constants.CENTRAL_SERVER,
					`Account is not active`,
					580, "AuthService", "checkUserLogin",
					user.getModel()),
				req, res, next);
			return;
		}
		// Check password
		Users.checkPasswordBCrypt(filteredRequest.password, user.getPassword()).then((match) => {
			// Check new and old version of hashing the password
			if (match || (user.getPassword() === Users.hashPassword(filteredRequest.password))) {
				// Password OK
				let companies,
					sites = [],
					siteAreas = [],
					chargingStations = [],
					users = [];
				// Read Eula
				global.storage.getEndUserLicenseAgreement(user.getLanguage()).then((endUserLicenseAgreement) => {
					// Set Eula Info on Login Only
					if (action == "Login") {
						user.setEulaAcceptedOn(new Date());
						user.setEulaAcceptedVersion(endUserLicenseAgreement.version);
						user.setEulaAcceptedHash(endUserLicenseAgreement.hash);
					}
					// Reset wrong number of trial
					user.setPasswordWrongNbrTrials(0);
					// Save
					return user.save();
				}).then(() => {
					// Get Companies
					if (user.getRole() == CentralRestServerAuthorization.ROLE_ADMIN) {
						// Nothing to get
						return Promise.resolve([]);
					} else {
						// Get companies
						return user.getCompanies();
					}
				}).then((foundCompanies) => {
					companies = foundCompanies;
					if (companies.length == 0) {
						return Promise.resolve([]);
					}
					// Get all the sites
					let proms = [];
					companies.forEach((company) => {
						proms.push(company.getSites());
					});
					return Promise.all(proms);
				}).then((foundSitesProms) => {
					// Merge results
					foundSitesProms.forEach((foundSitesProm) => {
						sites = sites.concat(foundSitesProm);
					});
					if (sites.length == 0) {
						return Promise.resolve([]);
					}
					// Get all the site areas
					let proms = [];
					sites.forEach((site) => {
						proms.push(site.getSiteAreas());
					})
					return Promise.all(proms);
				}).then((foundSiteAreasProms) => {
					// Merge results
					foundSiteAreasProms.forEach((foundSiteAreasProm) => {
						siteAreas = siteAreas.concat(foundSiteAreasProm);
					});
					if (siteAreas.length == 0) {
						return Promise.resolve([]);
					}
					// Get all the charging stations
					let proms = [];
					siteAreas.forEach((siteArea) => {
						proms.push(siteArea.getChargingStations());
					})
					return Promise.all(proms);
				}).then((foundChargingStationsProms) => {
					// Merge results
					foundChargingStationsProms.forEach((foundChargingStationsProm) => {
						chargingStations = chargingStations.concat(foundChargingStationsProm);
					});
					// Convert to IDs
					let companyIDs = companies.map((company) => {
						return company.getID();
					});
					let siteIDs = sites.map((site) => {
						return site.getID();
					});
					let siteAreaIDs = siteAreas.map((siteArea) => {
						return siteArea.getID();
					});
					let chargingStationIDs = chargingStations.map((chargingStation) => {
						return chargingStation.getID();
					});
					// Log it
					Logging.logSecurityInfo({
						user: user.getModel(),
						module: "AuthService", method: "checkUserLogin",
						action: action, message: `User logged in successfully`});
					// Get authorisation
					let authsDefinition = Authorizations.getAuthorizations();
					// Add user
					users.push(user.getID());
					// Parse the auth and replace values
					let authsDefinitionParsed = Mustache.render(
						authsDefinition,
						{
							"userID": users,
							"companyID": companyIDs,
							"siteID": siteIDs,
							"siteAreaID": siteAreaIDs,
							"chargingStationID": chargingStationIDs,
							"trim": () => {
								return (text, render) => {
									// trim trailing comma and whitespace
									return render(text).replace(/(,\s*$)/g, '');
								}
							}
						}
					);
					let userAuthDefinition = Authorizations.getAuthorizationFromRoleID(
						JSON.parse(authsDefinitionParsed), user.getRole());
					// Compile auths of the role
					let compiledAuths = compileProfile(userAuthDefinition.auths);
					// Yes: build payload
					let payload = {
						id: user.getID(),
						role: user.getRole(),
						name: user.getName(),
						tagIDs: user.getTagIDs(),
						firstName: user.getFirstName(),
						locale: user.getLocale(),
						language: user.getLanguage(),
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
				}).catch((err) => {
					// Log exception
					Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
				});
			} else {
				// Wrong Password
				// Add wrong trial + 1
				user.setPasswordWrongNbrTrials(user.getPasswordWrongNbrTrials() + 1);
				// Check if the number of trial is reached
				if (user.getPasswordWrongNbrTrials() >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
					// Too many attempts, lock user
					// User locked
					user.setStatus(Users.USER_STATUS_LOCKED);
					// Set blocking date
					user.setPasswordBlockedUntil(
						moment().add(_centralSystemRestConfig.passwordBlockedWaitTimeMin, "m").toDate()
					);
					// Save nbr of trials
					user.save().then(() => {
						Logging.logActionExceptionMessageAndSendResponse(
							action,
							new AppError(
								Constants.CENTRAL_SERVER,
								`User is locked`,
								570, "AuthService", "checkUserLogin",
								user.getModel()),
							req, res, next);
					});
				} else {
					// Wrong logon
					user.save().then(() => {
						Logging.logActionExceptionMessageAndSendResponse(
							action,
							new AppError(
								Constants.CENTRAL_SERVER,
								`User failed to log in, ${_centralSystemRestConfig.passwordWrongNumberOfTrial - user.getPasswordWrongNbrTrials()} trial(s) remaining`,
								401, "AuthService", "checkUserLogin",
								user.getModel()),
							req, res, next);
					});
				}
			}
		}).catch((err) => {
			// Log in the console also
			console.log(err);
			// Log exception
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = AuthService;
