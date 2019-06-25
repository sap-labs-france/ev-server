import Authorizations from '../../../authorization/Authorizations';
import NotificationHandler from '../../../notification/NotificationHandler';
import Logging from '../../../utils/Logging';
import Constants from '../../../utils/Constants';
import AppError from '../../../exception/AppError';
import AppAuthError from '../../../exception/AppAuthError';
import User from '../../../entity/User';
import Site from '../../../types/Site';
import Utils from '../../../utils/Utils';
import Database from '../../../utils/Database';
import UserSecurity from './security/UserSecurity';
import SettingStorage from "../../../storage/mongodb/SettingStorage";
import ERPService from "../../../integration/pricing/convergent-charging/ERPService";
import RatingService from "../../../integration/pricing/convergent-charging/RatingService";
import fs from "fs";
import SiteStorage from '../../../storage/mongodb/SiteStorage';

export default class UserService {
  static async handleAddSitesToUser(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = UserSecurity.filterAddSitesToUserRequest(req.body, req.user);
      // Check Mandatory fields
      if (!filteredRequest.userID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      if (!filteredRequest.siteIDs || (filteredRequest.siteIDs && filteredRequest.siteIDs.length <= 0)) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Site's IDs must be provided`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateUser(req.user, filteredRequest.userID)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_USER,
          filteredRequest.userID,
          Constants.HTTP_AUTH_ERROR,
          'UserService', 'handleAddSitesToUser',
          req.user);
      }
      // Get the User
      const user = await User.getUser(req.user.tenantID, filteredRequest.userID);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.userID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      // Get Sites
      for (const siteID of filteredRequest.siteIDs) {
        // Check the site
        const site = await SiteStorage.getSite(req.user.tenantID, siteID);
        if (!site) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Site with ID '${siteID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
            'UserService', 'handleAddSitesToUser', req.user);
        }
        // Check auth
        if (!Authorizations.canUpdateSite(req.user)) {
          throw new AppAuthError(
            Constants.ACTION_UPDATE,
            Constants.ENTITY_SITE,
            siteID,
            Constants.HTTP_AUTH_ERROR,
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
          `User's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      if (!filteredRequest.siteIDs || (filteredRequest.siteIDs && filteredRequest.siteIDs.length <= 0)) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Site's IDs must be provided`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateUser(req.user, filteredRequest.userID)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_USER,
          filteredRequest.userID,
          Constants.HTTP_AUTH_ERROR,
          'UserService', 'handleAddSitesToUser',
          req.user);
      }

      // Get the User
      const user = await User.getUser(req.user.tenantID, filteredRequest.userID);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.userID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleAddSitesToUser', req.user);
      }
      // Get Sites
      for (const siteID of filteredRequest.siteIDs) {
        // Check the site
        const site = await SiteStorage.getSite(req.user.tenantID, siteID);
        if (!site) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Site with ID '${siteID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
            'UserService', 'handleAddSitesToUser', req.user);
        }
        // Check auth
        if (!Authorizations.canUpdateSite(req.user)) {
          throw new AppAuthError(
            Constants.ACTION_UPDATE,
            Constants.ENTITY_SITE,
            siteID,
            Constants.HTTP_AUTH_ERROR,
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
          `User's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleDeleteUser', req.user);
      }

      // Check auth
      if (!Authorizations.canDeleteUser(req.user, filteredRequest.ID)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_USER,
          filteredRequest.ID,
          Constants.HTTP_AUTH_ERROR,
          'UserService', 'handleDeleteUser',
          req.user);
      }

      // Check Mandatory fields
      if (filteredRequest.ID === req.user.id) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User cannot delete himself`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleDeleteUser', req.user);
      }
      // Check email
      const user = await User.getUser(req.user.tenantID, filteredRequest.ID);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleDeleteUser', req.user);
      }
      // Deleted
      if (user.deleted) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.id}' is already deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleDeleteUser', req.user);
      }
      // Delete from site
      const sites = await user.getSites();
      for (const site of sites) {
        site.removeUser(user);
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
      if (!filteredRequest.id) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleDeleteUser', req.user);
      }
      // Check auth
      if (!Authorizations.canUpdateUser(req.user, filteredRequest.id)) {
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_USER,
          filteredRequest.id,
          Constants.HTTP_AUTH_ERROR,
          'UserService', 'handleUpdateUser',
          req.user);
      }
      // Check email
      const user = await User.getUser(req.user.tenantID, filteredRequest.id);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.id}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleUpdateUser', req.user);
      }
      // Check Mandatory fields
      User.checkIfUserValid(filteredRequest, user, req);
      // Deleted?
      if (user.deleted) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.id}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleUpdateUser', req.user);
      }
      // Check Mandatory fields
      User.checkIfUserValid(filteredRequest, user, req);
      // Check email
      const userWithEmail = await User.getUserByEmail(req.user.tenantID, filteredRequest.email);
      // Check if EMail is already taken
      if (userWithEmail && user.getID() !== userWithEmail.getID()) {
        // Yes!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Email '${filteredRequest.email}' already exists`, Constants.HTTP_USER_EMAIL_ALREADY_EXIST_ERROR,
          'UserService', 'handleUpdateUser', req.user);
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
      user.setLastChangedBy(new User(req.user.tenantID, { 'id': req.user.id }));
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
          `User's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleGetUser', req.user);
      }
      // Check auth
      if (!Authorizations.canReadUser(req.user, filteredRequest.ID)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_USER,
          filteredRequest.ID,
          Constants.HTTP_AUTH_ERROR, 'UserService', 'handleGetUser',
          req.user);
      }
      // Get the user
      const user = await User.getUser(req.user.tenantID, filteredRequest.ID);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleGetUser', req.user);
      }
      // Deleted?
      if (user.deleted) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.ID}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleGetUser', req.user);
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
          `User's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleGetUser', req.user);
      }
      // Check auth
      if (!Authorizations.canReadUser(req.user, filteredRequest.ID)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_USER,
          filteredRequest.ID,
          Constants.HTTP_AUTH_ERROR, 'UserService', 'handleGetUserImage',
          req.user);
      }
      // Get the logged user
      const user = await User.getUser(req.user.tenantID, filteredRequest.ID);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleGetUserImage', req.user);
      }
      // Deleted?
      if (user.deleted) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.ID}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleGetUserImage', req.user);
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
          Constants.HTTP_AUTH_ERROR,
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
          Constants.HTTP_AUTH_ERROR,
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
          'excludeSiteID': filteredRequest.ExcludeSiteID,
          'onlyRecordCount': filteredRequest.OnlyRecordCount
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      users.result = users.result.map((user) => {
        return user.getModel();
      });
      // Filter
      UserSecurity.filterUsersResponse(users, req.user);
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
          Constants.HTTP_AUTH_ERROR,
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
          'role': filteredRequest.Role,
          'onlyRecordCount': filteredRequest.OnlyRecordCount
        },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      users.result = users.result.map((user) => {
        return user.getModel();
      });
      // Filter
      UserSecurity.filterUsersResponse(users, req.user);
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
          Constants.HTTP_AUTH_ERROR,
          'UserService', 'handleCreateUser',
          req.user);
      }
      // Filter
      const filteredRequest = UserSecurity.filterUserCreateRequest(req.body, req.user);
      // Check Mandatory fields
      User.checkIfUserValid(filteredRequest, null, req);
      // Get the email
      const foundUser = await User.getUserByEmail(req.user.tenantID, filteredRequest.email);
      if (foundUser) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Email '${filteredRequest.email}' already exists`, Constants.HTTP_USER_EMAIL_ALREADY_EXIST_ERROR,
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
      // Set timestamp
      user.setCreatedBy(new User(req.user.tenantID, { 'id': req.user.id }));
      user.setCreatedOn(new Date());
      // Set default
      if (!filteredRequest.hasOwnProperty('notificationsActive')) {
        user.setNotificationsActive(true);
      }
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
      res.json(Object.assign({ id: newUser.getID() }, Constants.REST_RESPONSE_SUCCESS));
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
          `User's ID must be provided`, Constants.HTTP_GENERAL_ERROR,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      // Check auth
      if (!Authorizations.canReadUser(req.user, filteredRequest.ID)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_USER,
          filteredRequest.ID,
          Constants.HTTP_AUTH_ERROR, 'UserService', 'handleGetUserInvoice',
          req.user);
      }
      // Get the user
      const user = await User.getUser(req.user.tenantID, filteredRequest.ID);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.ID}' does not exist anymore`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      // Deleted?
      if (user.deleted) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with ID '${filteredRequest.ID}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      let setting = await SettingStorage.getSettingByIdentifier(req.user.tenantID, Constants.COMPONENTS.PRICING);
      setting = setting.getContent().convergentCharging;

      if (!setting) {
        Logging.logException({ "message": "Convergent Charging setting is missing" }, "UserInvoice", Constants.CENTRAL_SERVER, "UserService", "handleGetUserInvoice", req.user.tenantID, req.user);
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `An issue occurred while creating the invoice`, Constants.HTTP_AUTH_ERROR,
          'UserService', 'handleGetUserInvoice', req.user);
      }
      const ratingService = new RatingService(setting.url, setting.user, setting.password);
      const erpService = new ERPService(setting.url, setting.user, setting.password);
      let invoiceNumber;
      try {
        await ratingService.loadChargedItemsToInvoicing();
        invoiceNumber = await erpService.createInvoice(req.user.tenantID, user);
      } catch (exception) {
        Logging.logException(exception, "UserInvoice", Constants.CENTRAL_SERVER, "UserService", "handleGetUserInvoice", req.user.tenantID, req.user);
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `An issue occurred while creating the invoice`, Constants.HTTP_AUTH_ERROR,
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
          // Retry to get invoice
          invoice = await erpService.getInvoiceDocument(invoiceHeader, invoiceNumber);
        }
        if (!invoice) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `An error occurred while requesting invoice ${invoiceNumber}`,
            Constants.HTTP_PRICING_REQUEST_INVOICE_ERROR,
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
          `An error occurred while requesting invoice ${invoiceNumber}`,
          Constants.HTTP_PRICING_REQUEST_INVOICE_ERROR,
          'UserService', 'handleGetUserInvoice', req.user);
      }
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}
