const Authorizations = require('../../../authorization/Authorizations');
const NotificationHandler = require('../../../notification/NotificationHandler');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const User = require('../../../entity/User');
const Site = require('../../../entity/Site');
const Utils = require('../../../utils/Utils');
const Database = require('../../../utils/Database');
const UserSecurity = require('./security/UserSecurity');
const SettingStorage = require("../../../storage/mongodb/SettingStorage");
const ERPService = require("../../../integration/pricing/convergent-charging/ERPService");
const RatingService = require("../../../integration/pricing/convergent-charging/RatingService");
const fs = require("fs");

class UserService {
  static async handleAddSitesToUser(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = UserSecurity.filterAddSitesToUserRequest(req.body, req.user);
      // Check Mandatory fields
      if (!filteredRequest.userID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The User's ID must be provided`, 500,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      if (!filteredRequest.siteIDs || (filteredRequest.siteIDs && filteredRequest.siteIDs.length <= 0)) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site's IDs must be provided`, 500,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      // Get the User
      const user = await User.getUser(req.user.tenantID, filteredRequest.userID);
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
        const site = await Site.getSite(req.user.tenantID, siteID);
        if (!site) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `The Site with ID '${siteID}' does not exist anymore`, 550,
            'UserService', 'handleAddSitesToUser', req.user);
        }
        // Check auth
        if (!Authorizations.canUpdateSite(req.user, site.getModel())) {
          throw new AppAuthError(
            Constants.ACTION_UPDATE,
            Constants.ENTITY_SITE,
            siteID,
            560,
            'UserService', 'handleAddSitesToUser',
            req.user, user);
        }
      }
      // Save
      await User.addSitesToUser(req.user.tenantID, filteredRequest.userID, filteredRequest.siteIDs);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'UserService', method: 'handleAddSitesToUser',
        message: `User's Sites have been added successfully`, action: action
      });
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
      const filteredRequest = UserSecurity.filterRemoveSitesFromUserRequest(req.body, req.user);
      // Check Mandatory fields
      if (!filteredRequest.userID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The User's ID must be provided`, 500,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      if (!filteredRequest.siteIDs || (filteredRequest.siteIDs && filteredRequest.siteIDs.length <= 0)) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site's IDs must be provided`, 500,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      // Get the User
      const user = await User.getUser(req.user.tenantID, filteredRequest.userID);
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
        const site = await Site.getSite(req.user.tenantID, siteID);
        if (!site) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `The Site with ID '${siteID}' does not exist anymore`, 550,
            'UserService', 'handleAddSitesToUser', req.user);
        }
        // Check auth
        if (!Authorizations.canUpdateSite(req.user, site.getModel())) {
          throw new AppAuthError(
            Constants.ACTION_UPDATE,
            Constants.ENTITY_SITE,
            siteID,
            560,
            'UserService', 'handleAddSitesToUser',
            req.user, user);
        }
      }
      // Save
      await User.removeSitesFromUser(req.user.tenantID, filteredRequest.userID, filteredRequest.siteIDs);
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'UserService', method: 'handleAddSitesToUser',
        message: `User's Sites have been removed successfully`, action: action
      });
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
      const filteredRequest = UserSecurity.filterUserDeleteRequest(req.query, req.user);
      // Check Mandatory fields
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The User's ID must be provided`, 500,
          'UserService', 'handleDeleteUser', req.user);
      }
      // Check email
      const user = await User.getUser(req.user.tenantID, filteredRequest.ID);
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
      const sites = await user.getSites(false, false, false, true);
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
        tenantID: req.user.tenantID,
        user: req.user, actionOnUser: user.getModel(),
        module: 'UserService', method: 'handleDeleteUser',
        message: `User with ID '${user.getID()}' has been deleted successfully`,
        action: action
      });
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
      const filteredRequest = UserSecurity.filterUserUpdateRequest(req.body, req.user);
      // Check Mandatory fields
      User.checkIfUserValid(filteredRequest, req);
      // Check email
      const user = await User.getUser(req.user.tenantID, filteredRequest.id);
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
      const userWithEmail = await User.getUserByEmail(req.user.tenantID, filteredRequest.email);
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
        const newPasswordHashed = await User.hashPasswordBcrypt(filteredRequest.password);
        // Update the password
        user.setPassword(newPasswordHashed);
      }
      // Update timestamp
      user.setLastChangedBy(new User(req.user.tenantID, {'id': req.user.id}));
      user.setLastChangedOn(new Date());
      // Update User
      const updatedUser = await user.save();
      // Update User's Image
      await user.saveImage();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, actionOnUser: updatedUser.getModel(),
        module: 'UserService', method: 'handleUpdateUser',
        message: `User has been updated successfully`,
        action: action
      });
      // Notify
      if (statusHasChanged) {
        // Send notification
        NotificationHandler.sendUserAccountStatusChanged(
          updatedUser.getTenantID(),
          Utils.generateGUID(),
          updatedUser.getModel(),
          {
            'user': updatedUser.getModel(),
            'evseDashboardURL': Utils.buildEvseURL((await updatedUser.getTenant()).getSubdomain())
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
      const filteredRequest = UserSecurity.filterUserRequest(req.query, req.user);
      // User mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The User's ID must be provided`, 500,
          'UserService', 'handleGetUser', req.user);
      }
      // Get the user
      const user = await User.getUser(req.user.tenantID, filteredRequest.ID);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'UserService', 'handleGetUser', req.user);
      }
      // Deleted?
      if (user.deleted) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with ID '${filteredRequest.ID}' is logically deleted`, 550,
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
      const filteredRequest = UserSecurity.filterUserRequest(req.query, req.user);
      // User mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The User's ID must be provided`, 500,
          'UserService', 'handleGetUser', req.user);
      }
      // Get the logged user
      const user = await User.getUser(req.user.tenantID, filteredRequest.ID);
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
      const userImage = await User.getUserImage(req.user.tenantID, filteredRequest.ID);
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
      const userImages = await User.getUserImages(req.user.tenantID);
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
      const filteredRequest = UserSecurity.filterUsersRequest(req.query, req.user);
      // Get users
      const users = await User.getUsers(req.user.tenantID,
        {
          'search': filteredRequest.Search,
          'siteID': filteredRequest.SiteID,
          'role': filteredRequest.Role,
          'status': filteredRequest.Status,
          'excludeSiteID': filteredRequest.ExcludeSiteID
        },
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

  static async handleGetUsersInError(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListUsers(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_USERS,
          null,
          560,
          'UserService', 'handleGetUsersInError',
          req.user);
      }
      // Filter
      const filteredRequest = UserSecurity.filterUsersRequest(req.query, req.user);
      // Get users
      const users = await User.getUsersInError(req.user.tenantID,
        {
          'search': filteredRequest.Search,
          'siteID': filteredRequest.SiteID,
          'role': filteredRequest.Role
        },
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
      const filteredRequest = UserSecurity.filterUserCreateRequest(req.body, req.user);
      if (!filteredRequest.role) {
        // Set to default role
        filteredRequest.role = Constants.ROLE_BASIC;
        filteredRequest.status = Constants.USER_STATUS_INACTIVE;
      }
      // Check Mandatory fields
      User.checkIfUserValid(filteredRequest, req);
      // Get the email
      const foundUser = await User.getUserByEmail(req.user.tenantID, filteredRequest.email);
      if (foundUser) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The email '${filteredRequest.email}' already exists`, 510,
          'UserService', 'handleCreateUser', req.user);
      }
      // Create user
      const user = new User(req.user.tenantID, filteredRequest);
      // Set the password
      if (filteredRequest.password) {
        // Generate a hash for the given password
        const newPasswordHashed = await User.hashPasswordBcrypt(filteredRequest.password);
        // Generate a hash
        user.setPassword(newPasswordHashed);
      }
      // Update timestamp
      user.setCreatedBy(new User(req.user.tenantID, {'id': req.user.id}));
      user.setCreatedOn(new Date());
      // Save User
      const newUser = await user.save();
      // Update User's Image
      newUser.setImage(user.getImage());
      // Save
      await newUser.saveImage();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, actionOnUser: newUser.getModel(),
        module: 'UserService', method: 'handleCreateUser',
        message: `User with ID '${newUser.getID()}' has been created successfully`,
        action: action
      });
      // Ok
      res.json(Object.assign({id: newUser.getID()}, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetUserInvoice(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = UserSecurity.filterUserRequest(req.query, req.user);
      // User mandatory
      if (!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The User's ID must be provided`, 500,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      // Get the user
      const user = await User.getUser(req.user.tenantID, filteredRequest.ID);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      // Deleted?
      if (user.deleted) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with ID '${filteredRequest.ID}' is logically deleted`, 550,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      // Check auth
      if (!Authorizations.canReadUser(req.user, user.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_USER,
          user.getID(),
          560, 'UserService', 'handleGetUserInvoice',
          req.user);
      }
      let setting = await SettingStorage.getSettingByIdentifier(req.user.tenantID, Constants.COMPONENTS.PRICING);
      setting = setting.getContent().convergentCharging;
      const ratingService = new RatingService(setting.url, setting.user, setting.password);
      const erpService = new ERPService(setting.url, setting.user, setting.password);
      let invoiceNumber;
      try {
        await ratingService.loadChargedItemsToInvoicing();
        invoiceNumber = await erpService.createInvoice(req.user.tenantID, user);
      } catch (e) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `An issue occured while creating the invoice`, 560,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      if (!invoiceNumber) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `No invoices available`, 404,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      try {
        const invoiceHeader = await erpService.getInvoiceDocumentHeader(invoiceNumber);
        let invoice = await erpService.getInvoiceDocument(invoiceHeader, invoiceNumber);
        if (!invoice) {
          //retry to get invoice
          invoice = await erpService.getInvoiceDocument(invoiceHeader, invoiceNumber);
        }
        if (!invoice) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `An error occured while requesting invoice ${invoiceNumber}`, 561,
            'UserService', 'handleGetUserInvoice', req.user);
        }
        const filename = 'invoice.pdf';
        fs.writeFile(filename, invoice, (err) => {
          if (err) {
            throw err;
          }
          res.download(filename, (err) => {
            if (err) {
              throw err;
            }
            fs.unlink(filename, (err) => {
              if (err) {
                throw err;
              }
            });
          });
        });
      } catch (e) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `An error occured while requesting invoice ${invoiceNumber}`, 561,
          'UserService', 'handleGetUserInvoice', req.user);
      }
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}

module.exports = UserService;
