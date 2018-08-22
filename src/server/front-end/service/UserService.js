const Authorizations = require('../../../authorization/Authorizations');
const NotificationHandler = require('../../../notification/NotificationHandler');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const User = require('../../../model/User');
const Utils = require('../../../utils/Utils');
const Database = require('../../../utils/Database');
const UserSecurity = require('./security/UserSecurity');

class UserService {
	static async handleGetEndUserLicenseAgreement(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = UserSecurity.filterEndUserLicenseAgreementRequest(req.query, req.user);
			// Get it
			let endUserLicenseAgreement = await global.storage.getEndUserLicenseAgreement(filteredRequest.Language);
			res.json(
				// Filter
				UserSecurity.filterEndUserLicenseAgreementResponse(
					endUserLicenseAgreement, req.user)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleDeleteUser(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = UserSecurity.filterUserDeleteRequest(req.query, req.user);
			// Check Mandatory fields
			if(!filteredRequest.ID) {
					// Not Found!
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The User's ID must be provided`, 500, 
						'UserService', 'handleDeleteUser', req.user);
			}
			// Check email
			let user = await global.storage.getUser(filteredRequest.ID);
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' does not exist anymore`, 550, 
					'UserService', 'handleDeleteUser', req.user);
			}
			// Deleted
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' is already deleted`, 550, 
					'UserService', 'handleDeleteUser', req.user);
			}
			// Check auth
			if (!Authorizations.canDeleteUser(req.user, user.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Constants.ENTITY_USER,
					user.getID(),
					560, 
					'UserService', 'handleDeleteUser',
					req.user);
			}
			// Delete
			let sites = await user.getSites(false, false, false, true);
			for (const site of sites) {
				// Remove User
				site.removeUser(user);
				// Save
				await site.save();
			}
			// Delete User
			await user.delete();
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: user.getModel(),
				module: 'UserService', method: 'handleDeleteUser',
				message: `User with ID '${user.getID()}' has been deleted successfully`,
				action: action});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleUpdateUser(action, req, res, next) {
		try {
			let statusHasChanged = false;
			// Filter
			let filteredRequest = UserSecurity.filterUserUpdateRequest( req.body, req.user );
			// Check Mandatory fields
			User.checkIfUserValid(filteredRequest, req);
			// Check email
			let user = await global.storage.getUser(filteredRequest.id);
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' does not exist anymore`, 550, 
					'UserService', 'handleUpdateUser', req.user);
			}
			// Deleted?
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' is logically deleted`, 550, 
					'UserService', 'handleUpdateUser', req.user);
			}
			// Check email
			let userWithEmail = await global.storage.getUserByEmail(filteredRequest.email);
			// Check if EMail is already taken
			if (userWithEmail && user.getID() !== userWithEmail.getID()) {
				// Yes!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The email '${filteredRequest.email}' already exists`, 510, 
					'UserService', 'handleUpdateUser', req.user);
			}
			// Check auth
			if (!Authorizations.canUpdateUser(req.user, user.getModel())) {
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Constants.ENTITY_USER,
					user.getID(),
					560, 
					'UserService', 'handleUpdateUser',
					req.user, user);
			}
			// Check if Status has been changed
			if (filteredRequest.status &&
					filteredRequest.status !== user.getStatus()) {
				// Status changed
				statusHasChanged = true;
			}
			// Update
			Database.updateUser(filteredRequest, user.getModel());
			// Check the password
			if (filteredRequest.password && filteredRequest.password.length > 0) {
				// Generate the password hash
				let newPasswordHashed = await User.hashPasswordBcrypt(filteredRequest.password);
				// Update the password
				user.setPassword(newPasswordHashed);
			}
			// Update timestamp
			user.setLastChangedBy(new User({'id': req.user.id}));
			user.setLastChangedOn(new Date());
			// Update User
			let updatedUser = await user.save();
			// Update User's Image
			await user.saveImage();
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: updatedUser.getModel(),
				module: 'UserService', method: 'handleUpdateUser',
				message: `User has been updated successfully`,
				action: action});
			// Notify
			if (statusHasChanged) {
				// Send notification
				NotificationHandler.sendUserAccountStatusChanged(
					Utils.generateGUID(),
					updatedUser.getModel(),
					{
						'user': updatedUser.getModel(),
						'evseDashboardURL' : Utils.buildEvseURL()
					},
					updatedUser.getLocale()
				);
			}
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetUser(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = UserSecurity.filterUserRequest(req.query, req.user);
			// User mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The User's ID must be provided`, 500, 
					'UserService', 'handleGetUser', req.user);
			}
			// Get the user
			let user = await global.storage.getUser(filteredRequest.ID);
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' does not exist anymore`, 550, 
					'UserService', 'handleGetUser', req.user);
			}
			// Deleted?
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.id}' is logically deleted`, 550, 
					'UserService', 'handleGetUser', req.user);
			}
			// Check auth
			if (!Authorizations.canReadUser(req.user, user.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_USER,
					user.getID(),
					560, 'UserService', 'handleGetUser',
					req.user);
			}
			// Set the user
			res.json(
				// Filter
				UserSecurity.filterUserResponse(
					user.getModel(), req.user)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetUserImage(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = UserSecurity.filterUserRequest(req.query, req.user);
			// User mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The User's ID must be provided`, 500, 
					'UserService', 'handleGetUser', req.user);
			}
			// Get the logged user
			let user = await global.storage.getUser(filteredRequest.ID)
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.ID}' does not exist anymore`, 550, 
					'UserService', 'handleGetUserImage', req.user);
			}
			// Deleted?
			if (user.deleted) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The user with ID '${filteredRequest.ID}' is logically deleted`, 550, 
					'UserService', 'handleGetUserImage', req.user);
			}
			// Check auth
			if (!Authorizations.canReadUser(req.user, user.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_USER,
					user.getID(),
					560, 'UserService', 'handleGetUserImage',
					req.user);
			}
			// Get the user image
			let userImage = await global.storage.getUserImage(filteredRequest.ID);
			// Return 
			res.json(userImage);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetUserImages(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListUsers(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_USERS,
					null,
					560, 
					'UserService', 'handleGetUserImages',
					req.user);
			}
			// Get the user image
			let userImages = await global.storage.getUserImages();
			// Return
			res.json(userImages);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetUsers(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListUsers(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_USERS,
					null,
					560, 
					'UserService', 'handleGetUsers',
					req.user);
			}
			// Filter
			let filteredRequest = UserSecurity.filterUsersRequest(req.query, req.user);
			// Get users
			let users = await global.storage.getUsers(filteredRequest.Search, filteredRequest.SiteID, Constants.NO_LIMIT);
			var usersJSon = [];
			users.forEach((user) => {
				// Set the model
				usersJSon.push(user.getModel());
			});
			// Return
			res.json(
				// Filter
				UserSecurity.filterUsersResponse(usersJSon, req.user)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleCreateUser(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canCreateUser(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_CREATE,
					Constants.ENTITY_USER,
					null,
					560, 
					'UserService', 'handleCreateUser',
					req.user);
			}
			// Filter
			let filteredRequest = UserSecurity.filterUserCreateRequest( req.body, req.user );
			if (!filteredRequest.role) {
				// Set to default role
				filteredRequest.role = Constants.USER_ROLE_BASIC;
				filteredRequest.status = Constants.USER_STATUS_INACTIVE;
			}
			// Check Mandatory fields
			User.checkIfUserValid(filteredRequest, req);
			// Get the email
			let foundUser = await global.storage.getUserByEmail(filteredRequest.email);
			if (foundUser) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The email '${filteredRequest.email}' already exists`, 510, 
					'UserService', 'handleCreateUser', req.user);
			}
			// Generate a hash for the given password
			let newPasswordHashed = await User.hashPasswordBcrypt(filteredRequest.password);
			// Create user
			let user = new User(filteredRequest);
			// Set the password
			if (filteredRequest.password) {
				// Generate a hash
				user.setPassword(newPasswordHashed);
			}
			// Update timestamp
			user.setCreatedBy(new User({'id': req.user.id}));
			user.setCreatedOn(new Date());
			// Save User
			let newUser = await user.save();
			// Update User's Image
			newUser.setImage(user.getImage());
			// Save
			await newUser.saveImage();
			// Log
			Logging.logSecurityInfo({
				user: req.user, actionOnUser: newUser.getModel(),
				module: 'UserService', method: 'handleCreateUser',
				message: `User with ID '${newUser.getID()}' has been created successfully`,
				action: action});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}

module.exports = UserService;
