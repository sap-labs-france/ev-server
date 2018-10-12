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
const UserStorage = require('../../../storage/mongodb/UserStorage');
const SiteStorage = require('../../../storage/mongodb/SiteStorage');

class UserService {
	static async handleGetEndUserLicenseAgreement(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = UserSecurity.filterEndUserLicenseAgreementRequest(req.query, req.user);
			// Get it
			let endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(filteredRequest.Language);
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

	static async handleAddSitesToUser(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = UserSecurity.filterAddSitesToUserRequest( req.body, req.user );
			// Check Mandatory fields
			if(!filteredRequest.userID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The User's ID must be provided`, 500,
					'UserService', 'handleAddSitesToUser', req.user);
			}
			if(!filteredRequest.siteIDs || (filteredRequest.siteIDs && filteredRequest.siteIDs.length <= 0)) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site's IDs must be provided`, 500,
					'UserService', 'handleAddSitesToUser', req.user);
			}
			// Get the User
			let user = await UserStorage.getUser(filteredRequest.userID);
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The User with ID '${filteredRequest.userID}' does not exist anymore`, 550,
					'UserService', 'handleAddSitesToUser', req.user);
			}
			// Check auth
			if (!Authorizations.canUpdateUser(req.user, user.getModel())) {
				throw new AppAuthError(
					Constants.ACTION_UPDATE,
					Constants.ENTITY_USER,
					user.getID(),
					560,
					'UserService', 'handleAddSitesToUser',
					req.user, user);
			}
			// Get Sites
			for (const siteID of filteredRequest.siteIDs) {
				// Check the site
				let site = await SiteStorage.getSite(siteID);
				if (!site) {
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The Site with ID '${filteredRequest.id}' does not exist anymore`, 550,
						'UserService', 'handleAddSitesToUser', req.user);
				}
				// Check auth
				if (!Authorizations.canUpdateSite(req.user, site.getModel())) {
					throw new AppAuthError(
						Constants.ACTION_UPDATE,
						Constants.ENTITY_SITE,
						user.getID(),
						560,
						'UserService', 'handleAddSitesToUser',
						req.user, user);
				}
			}
			// Save
			await UserStorage.addSitesToUser(filteredRequest.userID, filteredRequest.siteIDs);
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'UserService', method: 'handleAddSitesToUser',
				message: `User's Sites have been added successfully`, action: action});
			// Ok
			res.json(Constants.REST_RESPONSE_SUCCESS);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleRemoveSitesFromUser(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = UserSecurity.filterRemoveSitesFromUserRequest( req.body, req.user );
			// Check Mandatory fields
			if(!filteredRequest.userID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The User's ID must be provided`, 500,
					'UserService', 'handleAddSitesToUser', req.user);
			}
			if(!filteredRequest.siteIDs || (filteredRequest.siteIDs && filteredRequest.siteIDs.length <= 0)) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Site's IDs must be provided`, 500,
					'UserService', 'handleAddSitesToUser', req.user);
			}
			// Get the User
			let user = await UserStorage.getUser(filteredRequest.userID);
			if (!user) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The User with ID '${filteredRequest.userID}' does not exist anymore`, 550,
					'UserService', 'handleAddSitesToUser', req.user);
			}
			// Check auth
			if (!Authorizations.canUpdateUser(req.user, user.getModel())) {
				throw new AppAuthError(
					Constants.ACTION_UPDATE,
					Constants.ENTITY_USER,
					user.getID(),
					560,
					'UserService', 'handleAddSitesToUser',
					req.user, user);
			}
			// Get Sites
			for (const siteID of filteredRequest.siteIDs) {
				// Check the site
				let site = await SiteStorage.getSite(siteID);
				if (!site) {
					throw new AppError(
						Constants.CENTRAL_SERVER,
						`The Site with ID '${filteredRequest.id}' does not exist anymore`, 550,
						'UserService', 'handleAddSitesToUser', req.user);
				}
				// Check auth
				if (!Authorizations.canUpdateSite(req.user, site.getModel())) {
					throw new AppAuthError(
						Constants.ACTION_UPDATE,
						Constants.ENTITY_SITE,
						user.getID(),
						560,
						'UserService', 'handleAddSitesToUser',
						req.user, user);
				}
			}
			// Save
			await UserStorage.removeSitesFromUser(filteredRequest.userID, filteredRequest.siteIDs);
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'UserService', method: 'handleAddSitesToUser',
				message: `User's Sites have been removed successfully`, action: action});
			// Ok
			res.json(Constants.REST_RESPONSE_SUCCESS);
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
			let user = await UserStorage.getUser(filteredRequest.ID);
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
					Constants.ACTION_DELETE,
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
			res.json(Constants.REST_RESPONSE_SUCCESS);
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
			let user = await UserStorage.getUser(filteredRequest.id);
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
			let userWithEmail = await UserStorage.getUserByEmail(filteredRequest.email);
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
					Constants.ACTION_UPDATE,
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
			res.json(Constants.REST_RESPONSE_SUCCESS);
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
			let user = await UserStorage.getUser(filteredRequest.ID);
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
					Constants.ACTION_READ,
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
			let user = await UserStorage.getUser(filteredRequest.ID)
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
					Constants.ACTION_READ,
					Constants.ENTITY_USER,
					user.getID(),
					560, 'UserService', 'handleGetUserImage',
					req.user);
			}
			// Get the user image
			let userImage = await UserStorage.getUserImage(filteredRequest.ID);
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
					Constants.ACTION_LIST,
					Constants.ENTITY_USERS,
					null,
					560,
					'UserService', 'handleGetUserImages',
					req.user);
			}
			// Get the user image
			let userImages = await UserStorage.getUserImages();
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
					Constants.ACTION_LIST,
					Constants.ENTITY_USERS,
					null,
					560,
					'UserService', 'handleGetUsers',
					req.user);
			}
			// Filter
			let filteredRequest = UserSecurity.filterUsersRequest(req.query, req.user);
			// Get users
			let users = await UserStorage.getUsers(
				{ 'search': filteredRequest.Search, 'siteID': filteredRequest.SiteID },
				filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
			// Set
			users.result = users.result.map((user) => user.getModel());
			// Filter
			users.result = UserSecurity.filterUsersResponse(
				users.result, req.user);
			// Return
			res.json(users);
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
					Constants.ACTION_CREATE,
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
				filteredRequest.role = Constants.ROLE_BASIC;
				filteredRequest.status = Constants.USER_STATUS_INACTIVE;
			}
			// Check Mandatory fields
			User.checkIfUserValid(filteredRequest, req);
			// Get the email
			let foundUser = await UserStorage.getUserByEmail(filteredRequest.email);
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
			res.json(Object.assign(Constants.REST_RESPONSE_SUCCESS, { id: newUser.getID() }));
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}

module.exports = UserService;
