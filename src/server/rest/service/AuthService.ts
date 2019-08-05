import axios from 'axios';
import { Handler, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import passport from 'passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import AppError from '../../../exception/AppError';
import Authorizations from '../../../authorization/Authorizations';
import AuthSecurity from './security/AuthSecurity';
import BadRequestError from '../../../exception/BadRequestError';
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../../utils/Configuration';
import Constants from '../../../utils/Constants';
import { HttpIsAuthorizedRequest, HttpLoginRequest, HttpResetPasswordRequest } from '../../../types/requests/HttpUserRequest';
import Logging from '../../../utils/Logging';
import NotificationHandler from '../../../notification/NotificationHandler';
import Site from '../../../types/Site';
import SiteArea from '../../../types/SiteArea';
import SiteStorage from '../../../storage/mongodb/SiteStorage';
import TenantStorage from '../../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import User from '../../../types/User';
import UserStorage from '../../../storage/mongodb/UserStorage';
import UserToken from '../../../types/UserToken';
import Utils from '../../../utils/Utils';

const _centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
let jwtOptions;

// Init JWT auth options
if (_centralSystemRestConfig) {
  // Set
  jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: _centralSystemRestConfig.userTokenKey
    // pragma issuer: 'evse-dashboard',
    // audience: 'evse-dashboard'
  };
  // Use
  passport.use(new Strategy(jwtOptions, (jwtPayload, done) =>
    // Return the token decoded right away
    done(null, jwtPayload)
  ));
}

export default class AuthService {

  public static initialize(): Handler {
    return passport.initialize();
  }

  public static authenticate() {
    return passport.authenticate('jwt', { session: false });
  }

  public static async handleIsAuthorized(action: string, req: Request, res: Response, next: NextFunction) {
    let user: User;
    // Default
    let result = [{ 'IsAuthorized': false }];
    // Filter
    const filteredRequest = AuthSecurity.filterIsAuthorizedRequest(req.query);
    // Check
    if (!filteredRequest.Action) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Action is mandatory',
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleIsAuthorized');
    }
    let chargingStation: ChargingStation = null;
    // Action
    switch (filteredRequest.Action) {
      // Hack for mobile app not sending the RemoteStopTransaction yet
      case 'StopTransaction':
      case 'RemoteStopTransaction':
        // Check
        if (!filteredRequest.Arg1) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            'The Charging Station ID is mandatory',
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleIsAuthorized');
        }
        // Get the Charging station
        chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.Arg1);
        // Found?
        if (!chargingStation) {
          // Not Found!
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Charging Station with ID '${filteredRequest.Arg1}' does not exist`,
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleIsAuthorized');
        }
        // Check
        if (!filteredRequest.Arg2) {
          const results = [];
          // Check authorization for each connectors
          for (let index = 0; index < chargingStation.connectors.length; index++) {
            const foundConnector = chargingStation.connectors.find((connector) => connector.connectorId === index + 1);
            const tempResult = { 'IsAuthorized': false };
            if (foundConnector && foundConnector.activeTransactionID) {
              tempResult.IsAuthorized = await AuthService.isStopTransactionAuthorized(
                filteredRequest, chargingStation, foundConnector.activeTransactionID, req.user);
            }
            results.push(tempResult);
          }
          // Return table of result (will be in the connector order)
          result = results;
        } else {
          result[0].IsAuthorized = await AuthService.isStopTransactionAuthorized(
            filteredRequest, chargingStation, filteredRequest.Arg2, req.user);
        }
        break;
      // Action on connectors of a charger
      case 'ConnectorsAction':
        // Arg1 contains the charger ID
        // Check
        if (!filteredRequest.Arg1) {
          throw new AppError(
            Constants.CENTRAL_SERVER,
            'The Charging Station ID is mandatory',
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleIsAuthorized');
        }
        // Get the Charging station
        chargingStation = await ChargingStationStorage.getChargingStation(req.user.tenantID, filteredRequest.Arg1);
        // Found?
        if (!chargingStation) {
          // Not Found!
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `Charging Station with ID '${filteredRequest.Arg1}' does not exist`,
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleIsAuthorized');
        }

        user = await UserStorage.getUser(req.user.tenantID, req.user.id);
        // Found?
        if (!user) {
          // Not Found!
          throw new AppError(
            Constants.CENTRAL_SERVER,
            `User with ID '${filteredRequest.Arg1}' does not exist`,
            Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleIsAuthorized');
        }
        result = await AuthService.checkConnectorsActionAuthorizations(req.user.tenantID, req.user, chargingStation);
        break;
    }
    // Return the result
    res.json(result.length === 1 ? result[0] : result);
    next();
  }

  public static async checkConnectorsActionAuthorizations(tenantID: string, user: UserToken, chargingStation: ChargingStation) {
    const results = [];
    // Check if organization component is active
    const isOrganizationComponentActive = Utils.isComponentActiveFromToken(user, Constants.COMPONENTS.ORGANIZATION);
    let siteArea: SiteArea;
    let site: Site;
    if (isOrganizationComponentActive) {
      // Site Area -----------------------------------------------
      siteArea = chargingStation.siteArea;
      try {
        // Site is mandatory
        if (!siteArea) {
          throw new AppError(
            chargingStation.id,
            `Charging Station '${chargingStation.id}' is not assigned to a Site Area!`,
            Constants.HTTP_AUTH_CHARGER_WITH_NO_SITE_AREA_ERROR,
            'AuthService', 'checkConnectorsActionAuthorizations');
        }

        // Site -----------------------------------------------------
        site = await SiteStorage.getSite(tenantID, siteArea.siteID);
        if (!site) {
          throw new AppError(
            chargingStation.id,
            `Site Area '${siteArea.name}' is not assigned to a Site!`,
            Constants.HTTP_AUTH_SITE_AREA_WITH_NO_SITE_ERROR,
            'AuthService', 'checkConnectorsActionAuthorizations',
            user);
        }
      } catch (error) {
        // Problem with site assignment so do not allow any action
        for (let index = 0; index < chargingStation.connectors.length; index++) {
          results.push(
            {
              'isStartAuthorized': false,
              'isStopAuthorized': false,
              'isTransactionDisplayAuthorized': false
            }
          );
        }
        return results;
      }
    }
    // Check authorization for each connectors
    for (let index = 0; index < chargingStation.connectors.length; index++) {
      const foundConnector = chargingStation.connectors.find(
        (connector) => connector.connectorId === index + 1);
      results.push(await Authorizations.getConnectorActionAuthorizations({ tenantID, user, chargingStation, connector: foundConnector, siteArea, site }));
    }
    return results;
  }

  public static async isStopTransactionAuthorized(filteredRequest: HttpIsAuthorizedRequest, chargingStation: ChargingStation, transactionId: number, user: UserToken) {
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(user.tenantID, transactionId);
    if (!transaction) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Transaction ID '${filteredRequest.Arg2}' does not exist`,
        Constants.HTTP_AUTH_ERROR, 'AuthService', 'isStopTransactionAuthorized');
    }
    // Check Charging Station
    if (transaction.getChargeBoxID() !== chargingStation.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Transaction ID '${filteredRequest.Arg2}' has a Charging Station '${transaction.getChargeBoxID()}' that differs from '${chargingStation.id}'`,
        565, 'AuthService', 'isStopTransactionAuthorized');
    }
    try {
      // Check
      await Authorizations.isTagIDsAuthorizedOnChargingStation(user.tenantID,
        chargingStation, user.tagIDs[0], transaction.getTagID(), filteredRequest.Action);
      // Ok
      return true;
    } catch (e) {
      // Ko
      return false;
    }
  }

  public static async handleLogIn(action: string, req: Request, res: Response, next: NextFunction) {
    let tenantID: string;
    // Filter
    const filteredRequest = AuthSecurity.filterLoginRequest(req.body);
    // Get Tenant
    tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    req.user = { tenantID };
    if (!tenantID) {
      tenantID = Constants.DEFAULT_TENANT;
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with email '${filteredRequest.email}' tried to log in with an unknown tenant '${filteredRequest.tenant}'!`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'AuthService', 'handleLogIn', null, null, action);
    }
    // Check
    if (!filteredRequest.email) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Email is mandatory',
        Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleLogIn');
    }
    if (!filteredRequest.password) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Password is mandatory',
        Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleLogIn');
    }
    if (!filteredRequest.acceptEula) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The End-user License Agreement is mandatory',
        Constants.HTTP_USER_EULA_ERROR,
        'AuthService', 'handleLogIn');
    }
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.email);
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The user with email '${filteredRequest.email}' does not exist for tenant '${(filteredRequest.tenant ? filteredRequest.tenant : tenantID)}'`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleLogIn');
    }
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The user with email '${filteredRequest.email}' is logically deleted`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleLogIn');
    }
    // Check if the number of trials is reached
    if (user.passwordWrongNbrTrials >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
      // Check if the user is still locked
      if (user.status === Constants.USER_STATUS_LOCKED) {
        // Yes: Check date to reset pass
        if (moment(user.passwordBlockedUntil).isBefore(moment())) {
          // Time elapsed: activate the account again
          Logging.logSecurityInfo({
            tenantID: req.user.tenantID,
            actionOnUser: user,
            module: 'AuthService', method: 'handleLogIn', action: action,
            message: 'User has been unlocked and can try to login again'
          });
          // Reinit nbr of trial and status
          user.passwordWrongNbrTrials = 0;
          user.passwordBlockedUntil = null;
          user.status = Constants.USER_STATUS_ACTIVE;
          // Save
          await UserStorage.saveUser(req.user.tenantID, user);
          // Check user
          await AuthService.checkUserLogin(action, tenantID, user, filteredRequest, req, res, next);
        } else {
          // Return data
          throw new AppError(
            Constants.CENTRAL_SERVER,
            'User is locked',
            Constants.HTTP_USER_LOCKED_ERROR,
            'AuthService', 'handleLogIn',
            user);
        }
      } else {
        // An admin has reactivated the account
        user.passwordWrongNbrTrials = 0;
        user.passwordBlockedUntil = null;
        // Check user
        await AuthService.checkUserLogin(action, tenantID, user, filteredRequest, req, res, next);
      }
    } else {
      // Nbr trials OK: Check user
      await AuthService.checkUserLogin(action, tenantID, user, filteredRequest, req, res, next);
    }
  }

  public static async handleRegisterUser(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterRegisterUserRequest(req.body);
    // Get the Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: 'tenant',
        message: 'The Tenant cannot be found'
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleRegisterUser', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }
    req.user = { tenantID };
    // Check EULA
    if (!filteredRequest.acceptEula) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The End-user License Agreement is mandatory',
        520, 'AuthService', 'handleLogIn');
    }
    // Check
    if (!filteredRequest.captcha) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The captcha is mandatory', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleRegisterUser');
    }
    // Check Captcha
    const response = await axios.get(
      `https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
    if (!response.data.success) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The captcha is invalid', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleRegisterUser');
    } else if (response.data.score < 0.5) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The captcha score is too low', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleRegisterUser');
    }
    // Check Mandatory fields
    Utils.checkIfUserValid(filteredRequest, null, req);
    // Check email
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.email);
    if (user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Email already exists', Constants.HTTP_USER_EMAIL_ALREADY_EXIST_ERROR,
        'AuthService', 'handleRegisterUser',
        null, user);
    }
    // Generate a password
    const newPasswordHashed = await Utils.hashPasswordBcrypt(filteredRequest.password);
    // Create the user
    const newUser = UserStorage.getEmptyUser();
    newUser.email = filteredRequest.email;
    newUser.name = filteredRequest.name;
    newUser.firstName = filteredRequest.firstName;
    if (tenantID === Constants.DEFAULT_TENANT) {
      newUser.role = Constants.ROLE_SUPER_ADMIN;
    } else {
      newUser.role = Constants.ROLE_BASIC;
    }
    newUser.status = Constants.USER_STATUS_PENDING;
    newUser.locale = req.locale.substring(0, 5);
    newUser.verificationToken = Utils.generateToken(req.body.email);
    const endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(tenantID, newUser.locale.substring(0, 2));
    newUser.eulaAcceptedOn = new Date();
    newUser.eulaAcceptedVersion = endUserLicenseAgreement.version;
    newUser.eulaAcceptedHash = endUserLicenseAgreement.hash;
    // Save User
    newUser.id = await UserStorage.saveUser(tenantID, newUser);
    // Save User password
    await UserStorage.saveUserPassword(tenantID, newUser.id, newPasswordHashed);
    // Save Tags
    const tagIDs = [newUser.name[0] + newUser.firstName[0] + Utils.getRandomInt()];
    await UserStorage.saveUserTags(tenantID, newUser.id, tagIDs);
    // Assign user to all sites with auto-assign flag set
    const sites = await SiteStorage.getSites(tenantID,
      { withAutoUserAssignment: true },
      Constants.DB_PARAMS_MAX_LIMIT
    );
    if (sites.count > 0) {
      const siteIDs = sites.result.map((site) => site.id);
      if (siteIDs && siteIDs.length > 0) {
        await UserStorage.addSitesToUser(tenantID, newUser.id, siteIDs);
      }
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: newUser, action: action,
      module: 'AuthService',
      method: 'handleRegisterUser',
      message: `User with Email '${req.body.email}' has been created successfully`,
      detailedMessages: req.body
    });

    if (tenantID !== Constants.DEFAULT_TENANT) {
      // Send notification
      const evseDashboardVerifyEmailURL = Utils.buildEvseURL(filteredRequest.tenant) +
        '/#/verify-email?VerificationToken=' + newUser.verificationToken + '&Email=' + newUser.email;
      // Notify (Async)
      NotificationHandler.sendNewRegisteredUser(
        tenantID,
        Utils.generateGUID(),
        newUser,
        {
          'user': newUser,
          'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant),
          'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
        },
        newUser.locale
      );
    }
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async checkAndSendResetPasswordConfirmationEmail(tenantID: string, filteredRequest: Partial<HttpResetPasswordRequest>, action: string, req: Request, res: Response, next: NextFunction) {
    // No hash: Send email with init pass hash link
    if (!filteredRequest.captcha) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The captcha is mandatory', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleUserPasswordReset');
    }
    // Check captcha
    const response = await axios.get(
      `https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
    // Check
    if (!response.data.success) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The reCaptcha is invalid',
        Constants.HTTP_AUTH_INVALID_CAPTCHA,
        'AuthService', 'handleRegisterUser');
    } else if (response.data.score < 0.5) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The reCaptcha score is too low, got ${response.data.score} and expected to be >= 0.5`,
        Constants.HTTP_AUTH_INVALID_CAPTCHA,
        'AuthService', 'handleRegisterUser');
    }
    // Yes: Generate new password
    const resetHash = Utils.generateGUID();
    // Generate a new password
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.email);
    // Found?
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with email '${filteredRequest.email}' does not exist`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'AuthService', 'handleUserPasswordReset');
    }
    // Deleted
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with email '${filteredRequest.email}' is logically deleted`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'AuthService', 'handleUserPasswordReset');
    }
    // Hash it
    user.passwordResetHash = resetHash;
    // Save the user
    await UserStorage.saveUser(tenantID, user);
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user, action: action,
      module: 'AuthService',
      method: 'handleUserPasswordReset',
      message: `User with Email '${req.body.email}' will receive an email to reset his password`
    });
    // Send notification
    const evseDashboardResetPassURL = Utils.buildEvseURL(filteredRequest.tenant) +
      '/#/reset-password?hash=' + resetHash + '&email=' +
      user.email;
    // Send Request Password (Async)
    NotificationHandler.sendRequestPassword(
      tenantID,
      Utils.generateGUID(),
      user,
      {
        'user': user,
        'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant),
        'evseDashboardResetPassURL': evseDashboardResetPassURL
      },
      user.locale
    );
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async generateNewPasswordAndSendEmail(tenantID: string, filteredRequest, action: string, req: Request, res: Response, next: NextFunction) {
    // Create the password
    const newPassword = Utils.generatePassword();
    // Hash it
    const newHashedPassword = await Utils.hashPasswordBcrypt(newPassword);
    // Get the user
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.email);
    // Found?
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with email '${filteredRequest.email}' does not exist`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleUserPasswordReset');
    }
    // Deleted
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User with email '${filteredRequest.email}' is logically deleted`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'handleUserPasswordReset');
    }
    // Check the hash from the db
    if (!user.passwordResetHash) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The user has already reset his password',
        540, 'AuthService', 'handleUserPasswordReset',
        user);
    }
    // Check the hash from the db
    if (filteredRequest.hash !== user.passwordResetHash) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The user's hash '${user.passwordResetHash}' do not match the requested one '${filteredRequest.hash}'`,
        540, 'AuthService', 'handleUserPasswordReset',
        user);
    }
    // Set the hashed password
    user.password = newHashedPassword;
    // Reset the hash
    user.passwordResetHash = null;
    // Save the user
    const currentId = await UserStorage.saveUser(tenantID, user);
    // Save new password
    await UserStorage.saveUserPassword(tenantID, currentId, user.password);
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user, action: action,
      module: 'AuthService',
      method: 'handleUserPasswordReset',
      message: 'User\'s password has been reset successfully',
      detailedMessages: req.body
    });
    // Send Password (Async)
    NotificationHandler.sendNewPassword(
      tenantID,
      Utils.generateGUID(),
      user,
      {
        'user': user,
        'hash': null,
        'newPassword': newPassword,
        'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant)
      },
      user.locale
    );
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleUserPasswordReset(action: string, req: Request, res: Response, next: NextFunction) {
    const filteredRequest = AuthSecurity.filterResetPasswordRequest(req.body);
    // Get Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: 'tenant',
        message: 'The Tenant is mandatory'
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleUserPasswordReset', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }
    // Check hash
    if (!filteredRequest.hash) {
      // Send Confirmation Email for requesting a new password
      await AuthService.checkAndSendResetPasswordConfirmationEmail(tenantID, filteredRequest, action, req, res, next);
    } else {
      // Send the new password
      await AuthService.generateNewPasswordAndSendEmail(tenantID, filteredRequest, action, req, res, next);
    }
  }

  public static async handleGetEndUserLicenseAgreement(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterEndUserLicenseAgreementRequest(req);
    // Get Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: 'tenant',
        message: 'The Tenant is mandatory'
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleGetEndUserLicenseAgreement', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }
    // Get it
    const endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(tenantID, filteredRequest.Language);
    res.json(
      // Filter
      AuthSecurity.filterEndUserLicenseAgreementResponse(
        endUserLicenseAgreement)
    );
    next();
  }

  public static async handleVerifyEmail(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterVerifyEmailRequest(req.query);
    // Get Tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: 'tenant',
        message: 'The Tenant is mandatory'
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleVerifyEmail', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }
    // Check that this is not the super tenant
    if (tenantID === Constants.DEFAULT_TENANT) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Cannot verify email in the Super Tenant', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleVerifyEmail');
    }
    // Check email
    if (!filteredRequest.Email) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Email is mandatory', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleVerifyEmail');
    }
    // Check verificationToken
    if (!filteredRequest.VerificationToken) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Verification Token is mandatory', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleVerifyEmail');
    }
    // Check email
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.Email);
    // User exists?
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The user with email '${filteredRequest.Email}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'AuthService', 'handleVerifyEmail');
    }
    // User deleted?
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The user with email '${filteredRequest.Email}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'AuthService', 'handleVerifyEmail', user);
    }
    // Check if account is already active
    if (user.status === Constants.USER_STATUS_ACTIVE) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Account is already active', Constants.HTTP_USER_ACCOUNT_ALREADY_ACTIVE_ERROR,
        'AuthService', 'handleVerifyEmail', user);
    }
    // Check verificationToken
    if (user.verificationToken !== filteredRequest.VerificationToken) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Wrong Verification Token', Constants.HTTP_AUTH_INVALID_TOKEN_ERROR,
        'AuthService', 'handleVerifyEmail', user);
    }
    // Activate user
    user.status = Constants.USER_STATUS_ACTIVE;
    // Clear verificationToken
    user.verificationToken = null;
    // Set verifiedAt
    user.verifiedAt = new Date();
    // Save
    await UserStorage.saveUser(tenantID, user);
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user, action: action,
      module: 'AuthService', method: 'handleVerifyEmail',
      message: 'User account has been successfully verified and activated',
      detailedMessages: req.query
    });
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static async handleResendVerificationEmail(action: string, req: Request, res: Response, next: NextFunction) {
    // Filter
    const filteredRequest = AuthSecurity.filterResendVerificationEmail(req.body);
    // Get the tenant
    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: 'tenant',
        message: 'The Tenant is mandatory'
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleResendVerificationEmail', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }
    // Check that this is not the super tenant
    if (tenantID === Constants.DEFAULT_TENANT) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Cannot request a verification Email in the Super Tenant', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleResendVerificationEmail');
    }
    // Check email
    if (!filteredRequest.email) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The Email is mandatory', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleResendVerificationEmail');
    }
    // Check captcha
    if (!filteredRequest.captcha) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The captcha is mandatory', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleResendVerificationEmail');
    }

    // Is valid captcha?
    const response = await axios.get(
      `https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
    if (!response.data.success) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The captcha is invalid', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleResendVerificationEmail');
    } else if (response.data.score < 0.5) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'The captcha score is too low', Constants.HTTP_GENERAL_ERROR,
        'AuthService', 'handleResendVerificationEmail');
    }
    // Is valid email?
    const user = await UserStorage.getUserByEmail(tenantID, filteredRequest.email);
    // User exists?
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The user with email '${filteredRequest.email}' does not exist`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'AuthService', 'handleResendVerificationEmail');
    }
    // User deleted?
    if (user.deleted) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `The user with email '${filteredRequest.email}' is logically deleted`, Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR,
        'AuthService', 'handleResendVerificationEmail', user);
    }
    // Check if account is already active
    if (user.status === Constants.USER_STATUS_ACTIVE) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'Account is already active', Constants.HTTP_USER_ACCOUNT_ALREADY_ACTIVE_ERROR,
        'AuthService', 'handleResendVerificationEmail', user);
    }
    let verificationToken;
    // Check verificationToken
    if (!user.verificationToken) {
      // Verification token was not created after registration
      // This should not happen
      // Generate new verificationToken
      verificationToken = Utils.generateToken(filteredRequest.email);
      user.verificationToken = verificationToken;
      // Save
      await UserStorage.saveUser(tenantID, user);
    } else {
      // Get existing verificationToken
      verificationToken = user.verificationToken;
    }
    // Log
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user,
      action: action,
      module: 'AuthService',
      method: 'handleResendVerificationEmail',
      message: `User with Email '${filteredRequest.email}' has been created successfully`,
      detailedMessages: req.body
    });
    // Send notification
    const evseDashboardVerifyEmailURL = Utils.buildEvseURL(filteredRequest.tenant) +
      '/#/verify-email?VerificationToken=' + verificationToken + '&Email=' +
      user.email;
    // Send Verification Email (Async)
    NotificationHandler.sendVerificationEmail(
      tenantID,
      Utils.generateGUID(),
      user,
      {
        'user': user,
        'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant),
        'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
      },
      user.locale
    );
    // Ok
    res.json(Constants.REST_RESPONSE_SUCCESS);
    next();
  }

  public static handleUserLogOut(action: string, req: Request, res: Response, next: NextFunction) {
    req.logout();
    res.status(200).send({});
  }

  public static async userLoginWrongPassword(action: string, tenantID: string, user: User, req: Request, res: Response, next: NextFunction) {
    // Add wrong trial + 1
    user.passwordWrongNbrTrials = user.passwordWrongNbrTrials + 1;
    // Check if the number of trial is reached
    if (user.passwordWrongNbrTrials >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
      // Too many attempts, lock user
      // User locked
      user.status = Constants.USER_STATUS_LOCKED;
      // Set blocking date
      user.passwordBlockedUntil = moment().add(_centralSystemRestConfig.passwordBlockedWaitTimeMin, 'm').toDate();
      // Save nbr of trials
      await UserStorage.saveUser(tenantID, user);
      // Log
      throw new AppError(
        Constants.CENTRAL_SERVER,
        'User is locked',
        Constants.HTTP_USER_LOCKED_ERROR,
        'AuthService', 'checkUserLogin',
        user
      );
    } else {
      // Wrong logon
      await UserStorage.saveUser(tenantID, user);
      // Log
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `User failed to log in, ${_centralSystemRestConfig.passwordWrongNumberOfTrial - user.passwordWrongNbrTrials} trial(s) remaining`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'checkUserLogin',
        user
      );
    }
  }

  public static async userLoginSucceeded(action: string, tenantID: string, user: User, req: Request, res: Response, next: NextFunction) {
    // Password / Login OK
    Logging.logSecurityInfo({
      tenantID: tenantID,
      user: user,
      module: 'AuthService', method: 'checkUserLogin',
      action: action, message: 'User logged in successfully'
    });
    // Get EULA
    const endUserLicenseAgreement = await UserStorage.getEndUserLicenseAgreement(tenantID, user.locale.substring(0, 2));
    // Set Eula Info on Login Only
    if (action === 'Login') {
      user.eulaAcceptedOn = new Date();
      user.eulaAcceptedVersion = endUserLicenseAgreement.version;
      user.eulaAcceptedHash = endUserLicenseAgreement.hash;
    }
    // Reset wrong number of trial
    user.passwordWrongNbrTrials = 0;
    user.passwordBlockedUntil = null;
    user.passwordResetHash = null;
    // Save
    await UserStorage.saveUser(tenantID, user);
    // Yes: build payload
    const payload: UserToken = await Authorizations.buildUserToken(tenantID, user);
    // Build token
    let token;
    // Role Demo?
    if (Authorizations.isDemo(user.role)) {
      token = jwt.sign(payload, jwtOptions.secretOrKey, {
        expiresIn: _centralSystemRestConfig.userDemoTokenLifetimeDays * 24 * 3600
      });
    } else {
      token = jwt.sign(payload, jwtOptions.secretOrKey, {
        expiresIn: _centralSystemRestConfig.userTokenLifetimeHours * 3600
      });
    }
    // Return it
    res.json({ token: token });
  }

  public static async getTenantID(subdomain: string) {
    // Check
    if (!subdomain) {
      return Constants.DEFAULT_TENANT;
    }
    // Get it
    const tenant = await TenantStorage.getTenantBySubdomain(subdomain);
    // Return
    return (tenant ? tenant.id : null);
  }

  public static async checkUserLogin(action: string, tenantID: string, user: User, filteredRequest: Partial<HttpLoginRequest>, req: Request, res: Response, next: NextFunction) {
    // User Found?
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Unknown user tried to log in with email '${filteredRequest.email}'`,
        Constants.HTTP_OBJECT_DOES_NOT_EXIST_ERROR, 'AuthService', 'checkUserLogin',
        user);
    }

    // Check password
    const match = await Utils.checkPasswordBCrypt(filteredRequest.password, user.password);
    // Check new and old version of hashing the password
    if (match || (user.password === Utils.hashPassword(filteredRequest.password))) {
      // Check if the account is pending
      if (user.status === Constants.USER_STATUS_PENDING) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          'Account is pending! User must activate his account in his email',
          Constants.HTTP_USER_ACCOUNT_PENDING_ERROR,
          'AuthService', 'checkUserLogin',
          user);
      }
      // Check if the account is active
      if (user.status !== Constants.USER_STATUS_ACTIVE) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Account is not active ('${user.status}')`,
          Constants.HTTP_USER_ACCOUNT_INACTIVE_ERROR,
          'AuthService', 'checkUserLogin',
          user);
      }
      // Login OK
      await AuthService.userLoginSucceeded(action, tenantID, user, req, res, next);
    } else {
      // Login KO
      await AuthService.userLoginWrongPassword(action, tenantID, user, req, res, next);
    }
  }
}

