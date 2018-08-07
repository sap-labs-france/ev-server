const Authorizations = require('../../../authorization/Authorizations');
const NotificationHandler = require('../../../notification/NotificationHandler');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Users = require('../../../utils/Users');
const User = require('../../../model/User');
const Utils = require('../../../utils/Utils');
const Database = require('../../../utils/Database');
const UserSecurity = require('./security/UserSecurity');

class UserService {
	static handleGetEndUserLicenseAgreement(action, req, res, next) {
		// Filter
		let filteredRequest = UserSecurity.filterEndUserLicenseAgreementRequest(req.query, req.user);
		// Get it
		global.storage.getEndUserLicenseAgreement(filteredRequest.Language).then((endUserLicenseAgreement) => {
			res.json(
				// Filter
				UserSecurity.filterEndUserLicenseAgreementResponse(
					endUserLicenseAgreement, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleDeleteUser(action, req, res, next) {
		// Filter
		let filteredRequest = UserSecurity.filterUserDeleteRequest(req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The user's ID must be provided`), req, res, next);
			return;
		}
		// Check email
		let user;
		global.storage.getUser(filteredRequest.ID).then((foundUser) => {
			user = foundUser;
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' does not exist anymore`,
					550, "UserService", "handleDeleteUser");
			}
			// Deleted
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' is logically deleted`,
					550, "UserService", "handleDeleteUser");
			}
			// Check auth
			if (!Authorizations.canDeleteUser(req.user, user.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Constants.ENTITY_USER,
					user.getID(),
					560, "UserService", "handleDeleteUser",
					req.user);
			}
			// Delete
			return user.getSites(false, false, false, true);
		}).then((sites) => {
			let proms = [];
			sites.forEach((site) => {
				// Remove User
				site.removeUser(user);
				// Save
				proms.push(site.save());
			});
			return Promise.all(proms);
		}).then((results) => {
			// Delete User
			return user.delete();
		}).then((result) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: user.getModel(),
				module: "UserService", method: "handleDeleteUser",
				message: `User with ID '${user.getID()}' has been deleted successfully`,
				action: action});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleUpdateUser(action, req, res, next) {
		let statusHasChanged=false;
		// Filter
		let filteredRequest = UserSecurity.filterUserUpdateRequest( req.body, req.user );
		let user, newPasswordHashed;
		// Check email
		global.storage.getUser(filteredRequest.id).then((foundUser) => {
			// Check Mandatory fields
			Users.checkIfUserValid(filteredRequest, req);
			user = foundUser;
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' does not exist anymore`,
					550, "UserService", "handleUpdateUser");
			}
			// Deleted?
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' is logically deleted`,
					550, "UserService", "handleUpdateUser");
			}
		}).then(() => {
			// Check email
			return global.storage.getUserByEmail(filteredRequest.email);
		}).then((userWithEmail) => {
			// Check if EMail is already taken
			if (userWithEmail && user.getID() !== userWithEmail.getID()) {
				// Yes!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The email '${filteredRequest.email}' already exists`,
					510, "UserService", "handleUpdateUser");
			}
			// Generate the password hash
			return Users.hashPasswordBcrypt(filteredRequest.password);
		}).then((passwordHashed) => {
			newPasswordHashed = passwordHashed;
			// Check auth
			if (!Authorizations.canUpdateUser(req.user, user.getModel())) {
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Constants.ENTITY_USER,
					user.getID(),
					560, "UserService", "handleUpdateUser",
					req.user, user);
			}
			// Check if Role is provided and has been changed
			if (filteredRequest.role &&
					filteredRequest.role !== user.getRole() &&
					req.user.role !== Users.USER_ROLE_ADMIN) {
				// Role provided and not an Admin
				Logging.logError({
					user: req.user, actionOnUser: user.getModel(),
					module: "UserService", method: "handleUpdateUser",
					message: `User with role '${req.user.role}' tried to change the role to '${filteredRequest.role}' without having the Admin priviledge` });
				// Override it
				filteredRequest.role = user.getRole();
			}
			// Check if Status has been changed
			if (filteredRequest.status &&
					filteredRequest.status !== user.getStatus()) {
				// Right to change?
				if (req.user.role !== Users.USER_ROLE_ADMIN) {
					// Role provided and not an Admin
					Logging.logError({
						user: req.user, actionOnUser: user.getModel(),
						module: "UserService", method: "handleUpdateUser",
						message: `User with role '${req.user.role}' tried to update the status to '${filteredRequest.status}' without having the Admin priviledge` });
					// Ovverride it
					filteredRequest.status = user.getStatus();
				} else {
					// Status changed
					statusHasChanged = true;
				}
			}
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Update
			Database.updateUser(filteredRequest, user.getModel());
			// Update timestamp
			user.setLastChangedBy(loggedUser);
			user.setLastChangedOn(new Date());
			// Check the password
			if (filteredRequest.password && filteredRequest.password.length > 0) {
				// Update the password
				user.setPassword(newPasswordHashed);
			}
			// Update User's Image
			return user.saveImage();
		}).then(() => {
			// Update User
			return user.save();
		}).then((updatedUser) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: updatedUser.getModel(),
				module: "UserService", method: "handleUpdateUser",
				message: `User has been updated successfully`,
				action: action});
			// Notify
			if (statusHasChanged) {
				// Send notification
				NotificationHandler.sendUserAccountStatusChanged(
					Utils.generateGUID(),
					updatedUser.getModel(),
					{
						"user": updatedUser.getModel(),
						"evseDashboardURL" : Utils.buildEvseURL()
					},
					updatedUser.getLocale());
			}
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetUser(action, req, res, next) {
		// Filter
		let filteredRequest = UserSecurity.filterUserRequest(req.query, req.user);
		// User mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The User's ID is mandatory`), req, res, next);
			return;
		}
		// Get the user
		global.storage.getUser(filteredRequest.ID).then((user) => {
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' does not exist anymore`,
					550, "UserService", "handleGetUser");
			}
			// Deleted?
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' is logically deleted`,
					550, "UserService", "handleGetUser");
			}
			// Check auth
			if (!Authorizations.canReadUser(req.user, user.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_USER,
					user.getID(),
					560, "UserService", "handleGetUser",
					req.user);
			}
			// Set the user
			res.json(
				// Filter
				UserSecurity.filterUserResponse(
					user.getModel(), req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetUserImage(action, req, res, next) {
		// Filter
		let filteredRequest = UserSecurity.filterUserRequest(req.query, req.user);
		// User mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The User's ID is mandatory`), req, res, next);
			return;
		}
		// Get the logged user
		let user;
		global.storage.getUser(filteredRequest.ID).then((foundUser) => {
			// Keep the user
			user = foundUser;
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "UserService", "handleGetUserImage");
			}
			// Deleted?
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.ID}' is logically deleted`,
					550, "UserService", "handleGetUserImage");
			}
			// Check auth
			if (!Authorizations.canReadUser(req.user, user.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_USER,
					user.getID(),
					560, "UserService", "handleGetUserImage",
					req.user);
			}
			// Get the user image
			return global.storage.getUserImage(filteredRequest.ID);
		}).then((userImage) => {
			// Found?
			if (userImage) {
				// Set the user
				res.json(userImage);
			} else {
				res.json(null);
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetUserImages(action, req, res, next) {
		// Check auth
		if (!Authorizations.canListUsers(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Constants.ENTITY_USERS,
				null,
				560, "UserService", "handleGetUserImages",
				req.user);
		}
		// Get the user image
		global.storage.getUserImages().then((userImages) => {
			res.json(userImages);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetUsers(action, req, res, next) {
		// Check auth
		if (!Authorizations.canListUsers(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_LIST,
				Constants.ENTITY_USERS,
				null,
				560, "UserService", "handleGetUsers",
				req.user);
		}
		// Filter
		let filteredRequest = UserSecurity.filterUsersRequest(req.query, req.user);
		// Get users
		global.storage.getUsers(filteredRequest.Search, filteredRequest.SiteID, Constants.NO_LIMIT).then((users) => {
			var usersJSon = [];
			users.forEach((user) => {
				// Set the model
				usersJSon.push(user.getModel());
			});
			// Return
			res.json(
				// Filter
				UserSecurity.filterUsersResponse(
					usersJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleCreateUser(action, req, res, next) {
		// Check auth
		if (!Authorizations.canCreateUser(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				Authorizations.ACTION_CREATE,
				Constants.ENTITY_USER,
				null,
				560, "UserService", "handleCreateUser",
				req.user);
		}
		// Filter
		let filteredRequest = UserSecurity.filterUserCreateRequest( req.body, req.user );
		if (!filteredRequest.role) {
			// Set to default role
			filteredRequest.role = Users.USER_ROLE_BASIC;
			filteredRequest.status = Users.USER_STATUS_INACTIVE;
		}
		let loggedUser, newUser, user;
		// Get the logged user
		global.storage.getUser(req.user.id).then((foundLoggedUser) => {
			// Check Mandatory fields
			Users.checkIfUserValid(filteredRequest, req);
			// Set
			loggedUser = foundLoggedUser;
			// Get the email
			return global.storage.getUserByEmail(filteredRequest.email);
		}).then((foundUser) => {
			if (foundUser) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The email '${filteredRequest.email}' already exists`,
					510, "UserService", "handleCreateUser");
			}
			// Generate a hash for the given password
			return Users.hashPasswordBcrypt(filteredRequest.password);
		}).then((newPasswordHashed) => {
			// Create user
			user = new User(filteredRequest);
			// Set the password
			if (filteredRequest.password) {
				// Generate a hash
				user.setPassword(newPasswordHashed);
			}
			// Update timestamp
			user.setCreatedBy(loggedUser);
			user.setCreatedOn(new Date());
			// Save User
			return user.save();
		}).then((createdUser) => {
			newUser = createdUser;
			// Update User's Image
			newUser.setImage(user.getImage());
			// Save
			return newUser.saveImage();
		}).then(() => {
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: newUser.getModel(),
				module: "UserService", method: "handleCreateUser",
				message: `User with ID '${newUser.getID()}' has been created successfully`,
				action: action});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = UserService;
