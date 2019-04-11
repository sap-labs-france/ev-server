const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const moment = require('moment');
const axios = require('axios');
const Logging = require('../../../utils/Logging');
const Constants = require('../../../utils/Constants');
const AppError = require('../../../exception/AppError');
const BadRequestError = require('../../../exception/BadRequestError');
const User = require('../../../entity/User');
const Tenant = require('../../../entity/Tenant');
const ChargingStation = require('../../../entity/ChargingStation');
const Site = require('../../../entity/Site');
const Utils = require('../../../utils/Utils');
const Configuration = require('../../../utils/Configuration');
const Authorizations = require('../../../authorization/Authorizations');
const NotificationHandler = require('../../../notification/NotificationHandler');
const AuthSecurity = require('./security/AuthSecurity');
const TransactionStorage = require('../../../storage/mongodb/TransactionStorage');

const _centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
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
    return passport.authenticate('jwt', {session: false});
  }

  static async handleIsAuthorized(action, req, res, next) {
    try {
      // Default
      let result = {'IsAuthorized': false};
      // Filter
      const filteredRequest = AuthSecurity.filterIsAuthorizedRequest(req.query);
      // Check
      if (!filteredRequest.Action) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Action is mandatory`,
          550, 'AuthService', 'handleIsAuthorized');
      }
      let chargingStation = null;
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
          // Get the Charging station
          chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.Arg1);
          // Found?
          if (!chargingStation) {
            // Not Found!
            throw new AppError(
              Constants.CENTRAL_SERVER,
              `Charging Station with ID '${filteredRequest.Arg1}' does not exist`,
              550, 'AuthService', 'handleIsAuthorized');
          }
          // Check
          if (!filteredRequest.Arg2) {
            const results = [];
            // check authorization for each connectors
            for (let index = 0; index < chargingStation.getConnectors().length; index++) {
              const connector = chargingStation.getConnector(index + 1);
              const tempResult = {'IsAuthorized': false};
              if (connector.activeTransactionID) {
                tempResult.IsAuthorized = await AuthService.isStopTransactionAuthorized(filteredRequest, chargingStation, connector.activeTransactionID, req.user);
              }
              results.push(tempResult);
            }
            // return table of result (will be in the connector order)
            result = results;
          } else {
            result.IsAuthorized = await AuthService.isStopTransactionAuthorized(filteredRequest, chargingStation, filteredRequest.Arg2, req.user);
          }
          break;
        // Action on conenctors of a charger
        case 'ConnectorsAction':
          // Arg1 contains the charger ID
          // Check
          if (!filteredRequest.Arg1) {
            throw new AppError(
              Constants.CENTRAL_SERVER,
              `The Charging Station ID is mandatory`,
              550, 'AuthService', 'handleIsAuthorized');
          }
          // Get the Charging station
          chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, filteredRequest.Arg1);
          // Found?
          if (!chargingStation) {
            // Not Found!
            throw new AppError(
              Constants.CENTRAL_SERVER,
              `Charging Station with ID '${filteredRequest.Arg1}' does not exist`,
              550, 'AuthService', 'handleIsAuthorized');
          }
          const user = await User.getUser(req.user.tenantID, req.user.id);
          // Found?
          if (!user) {
            // Not Found!
            throw new AppError(
              Constants.CENTRAL_SERVER,
              `User with ID '${filteredRequest.Arg1}' does not exist`,
              550, 'AuthService', 'handleIsAuthorized');
          }
          result = await AuthService.checkConnectorsActionAuthorizations(req.user.tenantID, user, chargingStation);
          break;
      }
      // Return the result
      res.json(result);
      next();
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next, Constants.DEFAULT_TENANT);
    }
  }

  static async checkConnectorsActionAuthorizations(tenantID, user, chargingStation) {
    const results = [];
    // check if organization component is active
    const tenant = await Tenant.getTenant(tenantID);
    const isOrganizationComponentActive = tenant.isComponentActive(Constants.COMPONENTS.ORGANIZATION);
    let siteArea;
    let site;
    if (isOrganizationComponentActive) {
      // Get charging station site
      // Site Area -----------------------------------------------
      siteArea = await chargingStation.getSiteArea();
      try {
        // Site is mandatory
        if (!siteArea) {
          // Reject Site Not Found
          throw new AppError(
            chargingStation.getID(),
            `Charging Station '${chargingStation.getID()}' is not assigned to a Site Area!`, 525,
            "AuthService", "checkConnectorsActionAuthorizations");
        }

        // Site -----------------------------------------------------
        site = await siteArea.getSite(null, true);
        if (!site) {
          // Reject Site Not Found
          throw new AppError(
            chargingStation.getID(),
            `Site Area '${siteArea.getName()}' is not assigned to a Site!`, 525,
            "AuthService", "checkConnectorsActionAuthorizations",
            user.getModel());
        }
      } catch (error) {
        // Problem with site assignment so do not allow any action
        for (let index = 0; index < chargingStation.getConnectors().length; index++) {
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
    // check authorization for each connectors
    for (let index = 0; index < chargingStation.getConnectors().length; index++) {
      const connector = chargingStation.getConnector(index + 1);
      results.push(await Authorizations.getConnectorActionAuthorizations(tenantID, user, chargingStation, connector, siteArea, site));
    }
    return results;
  }

  static async isStopTransactionAuthorized(filteredRequest, chargingStation, transactionId, user) {
    // Get Transaction
    const transaction = await TransactionStorage.getTransaction(user.tenantID, transactionId);
    if (!transaction) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Transaction ID '${filteredRequest.Arg2}' does not exist`,
        560, 'ChargingStationService', 'handleAction');
    }
    try {
      // Check
      await Authorizations.checkUserOnChargingStation(
        chargingStation, transaction.getTagID(), user.tagIDs[0], filteredRequest.Action);
      // Ok
      return true;
    } catch (e) {
      // Ko
      return false;
    }
  }

  static async handleLogIn(action, req, res, next) {
    // Filter
    const filteredRequest = AuthSecurity.filterLoginRequest(req.body);

    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      Logging.logSecurityError({
        tenantID: Constants.DEFAULT_TENANT, module: 'AuthService', method: 'handleLogIn',
        message: `User with email '${filteredRequest.email}' tried to log in with an unknown tenant '${filteredRequest.tenant}'!`,
        action: action
      });
      next(new AppError(Constants.CENTRAL_SERVER, 'Wrong email or password', 550, 'AuthService', 'handleLogIn'));
      return;
    }
    try {
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

      const user = await User.getUserByEmail(tenantID, filteredRequest.email);
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with email '${filteredRequest.email}' does not exist for tenant '${(filteredRequest.tenant ? filteredRequest.tenant : tenantID)}'`,
          550, 'AuthService', 'handleLogIn');
      }
      if (user.isDeleted()) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with email '${filteredRequest.email}' is logically deleted`,
          550, 'AuthService', 'handleLogIn');
      }
      // Check if the number of trials is reached
      if (user.getPasswordWrongNbrTrials() >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
        // Check if the user is still locked
        if (user.getStatus() === Constants.USER_STATUS_LOCKED) {
          // Yes: Check date to reset pass
          if (moment(user.getPasswordBlockedUntil()).isBefore(moment())) {
            // Time elapsed: activate the account again
            Logging.logSecurityInfo({
              tenantID: user.getTenantID(),
              actionOnUser: user.getModel(),
              module: 'AuthService', method: 'handleLogIn', action: action,
              message: `User has been unlocked and can try to login again`
            });
            // Reinit nbr of trial and status
            user.setPasswordWrongNbrTrials(0);
            user.setPasswordBlockedUntil(null);
            user.setStatus(Constants.USER_STATUS_ACTIVE);
            // Save
            await user.save(filteredRequest.tenant);
            // Check user
            await AuthService.checkUserLogin(action, user, filteredRequest, req, res, next);
          } else {
            // Return data
            throw new AppError(
              Constants.CENTRAL_SERVER, `User is locked`,
              550, 'AuthService', 'handleLogIn',
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
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next, tenantID);
    }
  }

  static async handleRegisterUser(action, req, res, next) {
    // Filter
    const filteredRequest = AuthSecurity.filterRegisterUserRequest(req.body);

    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: "tenant",
        message: "The Tenant is mandatory"
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleRegisterUser', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }
    try {
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
      const response = await axios.get(
        `https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
      // Check
      if (!response.data.success) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The captcha is invalid`, 500,
          'AuthService', 'handleRegisterUser');
      }
      // Check email
      const user = await User.getUserByEmail(tenantID, filteredRequest.email);
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
      const newPasswordHashed = await User.hashPasswordBcrypt(filteredRequest.password);
      // Create the user
      let newUser = new User(tenantID, filteredRequest);
      // Set data
      newUser.setStatus(Constants.USER_STATUS_PENDING);
      newUser.setRole(Constants.ROLE_BASIC);
      newUser.setPassword(newPasswordHashed);
      newUser.setLocale(req.locale.substring(0, 5));
      newUser.setCreatedOn(new Date());
      // Set BadgeID (eg.: 'SF20170131')
      newUser.setTagIDs([newUser.getName()[0] + newUser.getFirstName()[0] + Utils.getRandomInt()])
      // Assign user to all sites
      const sites = await Site.getSites(tenantID, {withAutoUserAssignment: true});
      // Set
      newUser.setSites(sites.result);
      // Get EULA
      const endUserLicenseAgreement = await User.getEndUserLicenseAgreement(tenantID, newUser.getLanguage());
      // Set Eula Info on Login Only
      newUser.setEulaAcceptedOn(new Date());
      newUser.setEulaAcceptedVersion(endUserLicenseAgreement.version);
      newUser.setEulaAcceptedHash(endUserLicenseAgreement.hash);
      // Generate Verification Token
      const verificationToken = Utils.generateToken(req.body.email);
      newUser.setVerificationToken(verificationToken);
      // Save
      newUser = await newUser.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: newUser.getTenantID(),
        user: newUser.getModel(), action: action,
        module: 'AuthService',
        method: 'handleRegisterUser',
        message: `User with Email '${req.body.email}' has been created successfully`,
        detailedMessages: req.body
      });
      // Send notification
      const evseDashboardVerifyEmailURL = Utils.buildEvseURL(filteredRequest.tenant) +
        '/#/verify-email?VerificationToken=' + verificationToken + '&Email=' +
        newUser.getEMail();
      NotificationHandler.sendNewRegisteredUser(
        newUser.getTenantID(),
        Utils.generateGUID(),
        newUser.getModel(),
        {
          'user': newUser.getModel(),
          'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant),
          'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
        },
        newUser.getLocale()
      );
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next, tenantID);
    }
  }

  static async checkAndSendResetPasswordConfirmationEmail(tenantID, filteredRequest, action, req, res, next) {
    try {
      // No hash: Send email with init pass hash link
      if (!filteredRequest.captcha) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The captcha is mandatory`, 500,
          'AuthService', 'handleUserPasswordReset');
      }
      // Check captcha
      const response = await axios.get(
        `https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
      // Check
      if (!response.data.success) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The captcha is invalid`, 500,
          'AuthService', 'handleRegisterUser');
      }
      // Yes: Generate new password
      const resetHash = Utils.generateGUID();
      // Generate a new password
      const user = await User.getUserByEmail(tenantID, filteredRequest.email);
      // Found?
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with email '${filteredRequest.email}' does not exist`, 550,
          'AuthService', 'handleUserPasswordReset');
      }
      // Deleted
      if (user.isDeleted()) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with email '${filteredRequest.email}' is logically deleted`, 550,
          'AuthService', 'handleUserPasswordReset');
      }
      // Hash it
      user.setPasswordResetHash(resetHash);
      // Save the user
      const savedUser = await user.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: savedUser.getTenantID(),
        user: savedUser.getModel(), action: action,
        module: 'AuthService',
        method: 'handleUserPasswordReset',
        message: `User with Email '${req.body.email}' will receive an email to reset his password`
      });
      // Send notification
      const evseDashboardResetPassURL = Utils.buildEvseURL(filteredRequest.tenant) +
        '/#/reset-password?hash=' + resetHash + '&email=' +
        savedUser.getEMail();
      // Send email
      NotificationHandler.sendRequestPassword(
        savedUser.getTenantID(),
        Utils.generateGUID(),
        savedUser.getModel(),
        {
          'user': savedUser.getModel(),
          'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant),
          'evseDashboardResetPassURL': evseDashboardResetPassURL
        },
        savedUser.getLocale()
      );
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next, Constants.DEFAULT_TENANT);
    }
  }

  static async generateNewPasswordAndSendEmail(tenantID, filteredRequest, action, req, res, next) {
    try {
      // Create the password
      const newPassword = User.generatePassword();
      // Hash it
      const newHashedPassword = await User.hashPasswordBcrypt(newPassword);
      // Get the user
      const user = await User.getUserByEmail(tenantID, filteredRequest.email);
      // Found?
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `User with email '${filteredRequest.email}' does not exist`,
          550, 'AuthService', 'handleUserPasswordReset');
      }
      // Deleted
      if (user.isDeleted()) {
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
      const newUser = await user.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: newUser.getTenantID(),
        user: newUser.getModel(), action: action,
        module: 'AuthService',
        method: 'handleUserPasswordReset',
        message: `User's password has been reset successfully`,
        detailedMessages: req.body
      });
      // Send notification
      NotificationHandler.sendNewPassword(
        newUser.getTenantID(),
        Utils.generateGUID(),
        newUser.getModel(),
        {
          'user': newUser.getModel(),
          'hash': null,
          'newPassword': newPassword,
          'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant)
        },
        newUser.getLocale()
      );
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next, Constants.DEFAULT_TENANT);
    }
  }

  static async handleUserPasswordReset(action, req, res, next) {
    // Filter
    const filteredRequest = AuthSecurity.filterResetPasswordRequest(req.body);

    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: "tenant",
        message: "The Tenant is mandatory"
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleUserPasswordReset', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }

    try {
      // Check hash
      if (!filteredRequest.hash) {
        // Send Confirmation Email for requesting a new password
        await AuthService.checkAndSendResetPasswordConfirmationEmail(tenantID, filteredRequest, action, req, res, next);
      } else {
        // Send the new password
        await AuthService.generateNewPasswordAndSendEmail(tenantID, filteredRequest, action, req, res, next);
      }
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next, tenantID);
    }
  }

  static async handleGetEndUserLicenseAgreement(action, req, res, next) {
    // Filter
    const filteredRequest = AuthSecurity.filterEndUserLicenseAgreementRequest(req);

    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: "tenant",
        message: "The Tenant is mandatory"
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleGetEndUserLicenseAgreement', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }
    try {
      // Get it
      const endUserLicenseAgreement = await User.getEndUserLicenseAgreement(tenantID, filteredRequest.Language);
      res.json(
        // Filter
        AuthSecurity.filterEndUserLicenseAgreementResponse(
          endUserLicenseAgreement)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next, tenantID);
    }
  }

  static async handleVerifyEmail(action, req, res, next) {
    // Filter
    const filteredRequest = AuthSecurity.filterVerifyEmailRequest(req.query);

    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: "tenant",
        message: "The Tenant is mandatory"
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleVerifyEmail', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }

    try {
      // Check email
      if (!filteredRequest.Email) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Email is mandatory`, 500,
          'AuthService', 'handleVerifyEmail');
      }
      // Check verificationToken
      if (!filteredRequest.VerificationToken) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Verification Token is mandatory`, 500,
          'AuthService', 'handleVerifyEmail');
      }
      // Check email
      const user = await User.getUserByEmail(tenantID, filteredRequest.Email);
      // User exists?
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with email '${filteredRequest.Email}' does not exist`, 550,
          'AuthService', 'handleVerifyEmail');
      }
      // User deleted?
      if (user.isDeleted()) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with email '${filteredRequest.Email}' is logically deleted`, 550,
          'AuthService', 'handleVerifyEmail', user.getModel());
      }
      // Check if account is already active
      if (user.getStatus() === Constants.USER_STATUS_ACTIVE) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Account is already active`, 530,
          'AuthService', 'handleVerifyEmail', user.getModel());
      }
      // Check verificationToken
      if (user.getVerificationToken() !== filteredRequest.VerificationToken) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Wrong Verification Token`, 540,
          'AuthService', 'handleVerifyEmail', user.getModel());
      }
      // Activate user
      user.setStatus(Constants.USER_STATUS_ACTIVE);
      // Clear verificationToken
      user.setVerificationToken(null);
      // Set verifiedAt
      user.setVerifiedAt(new Date());
      // Save
      await user.save();
      // Log
      Logging.logSecurityInfo({
        tenantID: user.getTenantID(),
        user: user.getModel(), action: action,
        module: 'AuthService', method: 'handleVerifyEmail',
        message: `User account has been successfully verified and activated`,
        detailedMessages: req.query
      });
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next, tenantID);
    }
  }

  static async handleResendVerificationEmail(action, req, res, next) {
    // Filter
    const filteredRequest = AuthSecurity.filterResendVerificationEmail(req.body);

    const tenantID = await AuthService.getTenantID(filteredRequest.tenant);
    if (!tenantID) {
      const error = new BadRequestError({
        path: "tenant",
        message: "The Tenant is mandatory"
      });
      // Log Error
      Logging.logException(error, action, Constants.CENTRAL_SERVER, 'AuthService', 'handleResendVerificationEmail', Constants.DEFAULT_TENANT);
      next(error);
      return;
    }
    try {
      // Check email
      if (!filteredRequest.email) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Email is mandatory`, 500,
          'AuthService', 'handleResendVerificationEmail');
      }
      // Check captcha
      if (!filteredRequest.captcha) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The captcha is mandatory`, 500,
          'AuthService', 'handleResendVerificationEmail');
      }

      // Is valid captcha?
      const response = await axios.get(
        `https://www.google.com/recaptcha/api/siteverify?secret=${_centralSystemRestConfig.captchaSecretKey}&response=${filteredRequest.captcha}&remoteip=${req.connection.remoteAddress}`);
      if (!response.data.success) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The captcha is invalid`, 500,
          'AuthService', 'handleResendVerificationEmail');
      }
      // Is valid email?
      let user = await User.getUserByEmail(tenantID, filteredRequest.email);
      // User exists?
      if (!user) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with email '${filteredRequest.email}' does not exist`, 550,
          'AuthService', 'handleResendVerificationEmail');
      }
      // User deleted?
      if (user.isDeleted()) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The user with email '${filteredRequest.email}' is logically deleted`, 550,
          'AuthService', 'handleResendVerificationEmail', user.getModel());
      }
      // Check if account is already active
      if (user.getStatus() === Constants.USER_STATUS_ACTIVE) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Account is already active`, 530,
          'AuthService', 'handleResendVerificationEmail', user.getModel());
      }

      let verificationToken;
      // Check verificationToken
      if (user.getVerificationToken() === null) {
        // Verification token was not created after registration
        // This should not happen
        // Generate new verificationToken
        verificationToken = Utils.generateToken(filteredRequest.email);
        user.setVerificationToken(verificationToken);
        // Save
        user = await user.save();
      } else {
        // Get existing verificationToken
        verificationToken = user.getVerificationToken();
      }
      // Log
      Logging.logSecurityInfo({
        tenantID: user.getTenantID(),
        user: user.getModel(),
        action: action,
        module: 'AuthService',
        method: 'handleResendVerificationEmail',
        message: `User with Email '${filteredRequest.email}' has been created successfully`,
        detailedMessages: req.body
      });
      // Send notification
      const evseDashboardVerifyEmailURL = Utils.buildEvseURL(filteredRequest.tenant) +
        '/#/verify-email?VerificationToken=' + verificationToken + '&Email=' +
        user.getEMail();
      NotificationHandler.sendVerificationEmail(
        user.getTenantID(),
        Utils.generateGUID(),
        user.getModel(),
        {
          'user': user.getModel(),
          'evseDashboardURL': Utils.buildEvseURL(filteredRequest.tenant),
          'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
        },
        user.getLocale()
      );
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (err) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next, tenantID);
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
        550, 'AuthService', 'checkUserLogin',
        user.getModel()
      );
    }
  }

  static async userLoginSucceeded(action, user, req, res, next) {
    // Password / Login OK
    Logging.logSecurityInfo({
      tenantID: user.getTenantID(),
      user: user.getModel(),
      module: 'AuthService', method: 'checkUserLogin',
      action: action, message: `User logged in successfully`
    });
    // Get EULA
    const endUserLicenseAgreement = await User.getEndUserLicenseAgreement(user.getTenantID(), user.getLanguage());
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
    const auths = await Authorizations.buildAuthorizations(user);
    // Yes: build payload
    const payload = {
      'id': user.getID(),
      'role': user.getRole(),
      'name': user.getName(),
      'tagIDs': user.getTagIDs(),
      'firstName': user.getFirstName(),
      'locale': user.getLocale(),
      'language': user.getLanguage(),
      'tenantID': user.getTenantID(),
      'auths': auths
    };
    // Get active components from tenant if not default
    if (user.getTenantID() != Constants.DEFAULT_TENANT) {
      const tenant = await user.getTenant();
      payload.activeComponents = tenant.getActiveComponents();
    }

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
    res.json({token: token});
  }

  static async getTenantID(subdomain) {
    if (subdomain === undefined) {
      return null;
    }
    // Check
    if (!subdomain) {
      return Constants.DEFAULT_TENANT;
    }
    // Get it
    const tenant = await Tenant.getTenantBySubdomain(subdomain);
    // Return
    return (tenant ? tenant.getID() : null);
  }

  static async checkUserLogin(action, user, filteredRequest, req, res, next) {
    // User Found?
    if (!user) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Unknown user tried to log in with email '${filteredRequest.email}'`,
        550, 'AuthService', 'checkUserLogin',
        user.getModel());
    }
    // Check password
    const match = await User.checkPasswordBCrypt(filteredRequest.password, user.getPassword());
    // Check new and old version of hashing the password
    if (match || (user.getPassword() === User.hashPassword(filteredRequest.password))) {
      // Check if the account is pending
      if (user.getStatus() === Constants.USER_STATUS_PENDING) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Account is pending! User must activate his account in his email`, 590,
          'AuthService', 'checkUserLogin',
          user.getModel());
      }
      // Check if the account is active
      if (user.getStatus() !== Constants.USER_STATUS_ACTIVE) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Account is not active ('${user.getStatus()}')`, 580,
          'AuthService', 'checkUserLogin',
          user.getModel());
      }
      // Login OK
      await AuthService.userLoginSucceeded(action, user, req, res, next);
    } else {
      // Login KO
      await AuthService.userLoginWrongPassword(action, user, req, res, next);
    }
  }
}

module.exports = AuthService;
