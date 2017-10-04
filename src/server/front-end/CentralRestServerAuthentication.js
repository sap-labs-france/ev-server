const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const Users = require('../../utils/Users');
const NotificationHandler = require('../../notification/NotificationHandler');
const Logging = require('../../utils/Logging');
const User = require('../../model/User');
const Utils = require('../../utils/Utils');
const AppError = require('../../utils/AppError');
const Configuration = require('../../utils/Configuration');
const Authorization = require('../../utils/Authorization');
const compileProfile = require('node-authorization').profileCompiler;
const Mustache = require('mustache');
const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');
const SecurityRestObjectFiltering = require('./SecurityRestObjectFiltering');
const moment = require('moment');
const https = require('https');

require('source-map-support').install();

let _centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();

// Init JWT auth options
var jwtOptions = {
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

module.exports = {
  // Init Passport
  initialize() {
    return passport.initialize();
  },

  authenticate() {
    return passport.authenticate('jwt', { session: false });
  },

  authService(req, res, next) {
    // Parse the action
    var action = /^\/\w*/g.exec(req.url)[0].substring(1);
    // Check Context
    switch (req.method) {
      // Create Request
      case "POST":
        // Action
        switch (action) {
          // Login
          case "login":
            // Filter
            filteredRequest = SecurityRestObjectFiltering.filterLoginRequest(req.body);
            // Check
            if (!filteredRequest.email) {
              Logging.logActionErrorMessageAndSendResponse(action, `The email is mandatory`, req, res, next);
              return;
            }
            if (!filteredRequest.password) {
              Logging.logActionErrorMessageAndSendResponse(action, `The password is mandatory`, req, res, next);
              return;
            }
            // Check email
            global.storage.getUserByEmail(filteredRequest.email).then((user) => {
              // Check if the number of trials is reached
              if (user.getPasswordWrongNbrTrials() >= _centralSystemRestConfig.passwordWrongNumberOfTrial) {
                // Check if the user is still locked
                if (user.getStatus() === Users.USER_STATUS_LOCKED) {
                  // Yes: Check date to reset pass
                  if (moment(user.getPasswordBlockedUntil()).isBefore(moment())) {
                    // Time elapsed: activate the account again
                    Logging.logInfo({
                      userFullName: "Unknown", source: "Central Server", module: "CentralServerAuthentication", method: "authService", action: action,
                      message: `User '${Utils.buildUserFullName(user.getModel())}' has been unlocked and can try to login again`});
                    // Reinit nbr of trial and status
                    user.setPasswordWrongNbrTrials(0);
                    user.setStatus(Users.USER_STATUS_ACTIVE);
                    // Save
                    user.save().then(() => {
                      // Check user
                      module.exports.checkUserLogin(action, user, filteredRequest, req, res, next);
                    });
                  } else {
                    // Block
                    // Log it
                    Logging.logError({
                      userFullName: "Unknown", source: "Central Server", module: "CentralServerAuthentication", method: "authService", action: action,
                      message: `User '${Utils.buildUserFullName(user.getModel())}' try to login but his account is locked`});
                    // Return data
                    res.status(450).send({"message": Utils.hideShowMessage("User is locked: too many attempts")});
                    next();
                  }
                } else {
                  // An admin has reactivated the account
                  user.setPasswordWrongNbrTrials(0);
                  // Check user
                  module.exports.checkUserLogin(action, user, filteredRequest, req, res, next);
                }
              } else {
                // Nbr trials OK: Check user
                module.exports.checkUserLogin(action, user, filteredRequest, req, res, next);
              }
            }).catch((err) => {
              // Log
              Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
            });
            break;

          // Register User
          case "registeruser":
            // Filter
            filteredRequest = SecurityRestObjectFiltering.filterRegisterUserRequest(req.body);
            // Check
            if (!filteredRequest.captcha) {
              Logging.logActionErrorMessageAndSendResponse(action, `The captcha is mandatory`, req, res, next);
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
                  Logging.logActionErrorMessageAndSendResponse(action, `The captcha is invalid`, req, res, next);
                  return;
                }
                // Check Mandatory fields
                if (Users.checkIfUserValid("RegisterUser", filteredRequest, req, res, next)) {
                  // Check email
                  global.storage.getUserByEmail(filteredRequest.email).then((user) => {
                    if (user) {
                      throw new AppError(`The email ${filteredRequest.email} already exists`, 510);
                    }
                    // Generate a password
                    return Users.hashPasswordBcrypt(filteredRequest.password);
                  }).then((newPasswordHashed) => {
                    // Create the user
                    var newUser = new User(filteredRequest);
                    // Set data
                    newUser.setStatus(Users.USER_STATUS_PENDING);
                    newUser.setRole(Users.USER_ROLE_BASIC);
                    newUser.setPassword(newPasswordHashed);
                    newUser.setCreatedBy("Central Server");
                    newUser.setCreatedOn(new Date());
                    // Save
                    return newUser.save();
                  }).then((newUser) => {
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
              Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
            break;

          // Reset password
          case "reset":
            // Filter
            filteredRequest = SecurityRestObjectFiltering.filterResetPasswordRequest(req.body);
            // Check hash
            if (!filteredRequest.hash) {
              // No hash: Send email with init pass hash link
              if (!filteredRequest.captcha) {
                Logging.logActionErrorMessageAndSendResponse(action, `The captcha is mandatory`, req, res, next);
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
                    Logging.logActionErrorMessageAndSendResponse(action, `The captcha is invalid`, req, res, next);
                    return;
                  }
                  // Yes: Generate new password
                  let resetHash = Utils.generateGUID();
                  // Generate a new password
                  global.storage.getUserByEmail(filteredRequest.email).then((user) => {
                    // Found?
                    if (!user) {
                      throw new AppError(`User with email ${filteredRequest.email} does not exist`, 545);
                    }
                    // Hash it
                    user.setPasswordResetHash(resetHash);
                    // Save the user
                    return user.save();
                  }).then((savedUser) => {
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
                Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
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
                  throw new AppError(`User with email ${filteredRequest.email} does not exist`, 545);
                }
                // Check the hash from the db
                if (!user.getPasswordResetHash() || filteredRequest.hash !== user.getPasswordResetHash()) {
                  throw new AppError(`The user's hash do not match`, 535);
                }
                // Set the hashed password
                user.setPassword(newHashedPassword);
                // Reset the hash
                user.setPasswordResetHash(null);
                // Save the user
                return user.save();
              }).then((newUser) => {
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
            break;

          default:
            // Action provided
            if (!action) {
              // Log
              Logging.logActionErrorMessageAndSendResponse("N/A", `No Action has been provided`, req, res, next);
            } else {
              // Log
              Logging.logActionErrorMessageAndSendResponse("N/A", `The Action '${action}' does not exist`, req, res, next);
            }
            next();
        }
        break;

      // Create Request
      case "GET":
        // Action
        switch (action) {
          // Log out
          case "logout":
            req.logout();
            res.status(200).send({});
            break;
        }
    }
  },
  checkUserLogin(action, user, filteredRequest, req, res, next) {
    // User Found?
    if (user) {
      // Check if the account is active
      if (user.getStatus() !== Users.USER_STATUS_ACTIVE) {
        Logging.logActionErrorMessageAndSendResponse(action, `Your account ${user.getEMail()} is not yet active`, req, res, next, 550);
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
          Logging.logInfo({
            user: user.getModel(), source: "Central Server", module: "CentralServerAuthentication", method: "authService", action: action,
            message: `User ${Utils.buildUserFullName(user.getModel())} logged in successfully`});
          // Get authorisation
          let userRole = Authorization.getAuthorizationFromRoleID(user.getRole());
          // Parse the auth and replace values
          var parsedAuths = Mustache.render(JSON.stringify(userRole.auths), {"user": user.getModel()});
          // Compile auths of the role
          var compiledAuths = compileProfile(JSON.parse(parsedAuths));
          // Yes: build payload
          var payload = {
              id: user.getID(),
              role: user.getRole(),
              auths: compiledAuths
          };
          // Build token
          var token;
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
            Logging.logError({
              userFullName: "Unknown", source: "Central Server", module: "CentralServerAuthentication", method: "authService", action: action,
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
            Logging.logError({
              userFullName: "Unknown", source: "Central Server", module: "CentralServerAuthentication", method: "authService", action: action,
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
      Logging.logError({
        userFullName: "Unknown", source: "Central Server", module: "CentralServerAuthentication", method: "authService", action: action,
        message: `Unknown user tried to log in with email '${filteredRequest.email}'`});
      // User not found
      res.sendStatus(401);
      next();
    }
  }
};
