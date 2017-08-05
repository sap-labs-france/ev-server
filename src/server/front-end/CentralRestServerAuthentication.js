const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const Users = require('../../utils/Users');
const EMail = require('../../email/EMail');
const Logging = require('../../utils/Logging');
const User = require('../../model/User');
const Utils = require('../../utils/Utils');
const Configuration = require('../../utils/Configuration');
const Authorization = require('../../utils/Authorization');
const compileProfile = require('node-authorization').profileCompiler;
const Mustache = require('mustache');
const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');

let _centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();

// Init JWT auth options
var jwtOptions = {
  secretOrKey: _centralSystemRestConfig.userTokenKey,
  jwtFromRequest: ExtractJwt.fromAuthHeader()
  // issuer: 'evse-dashboard',
  // audience: 'evse-dashboard'
};

// Use
passport.use(new JwtStrategy(jwtOptions, function(jwtPayload, done) {
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
            // Check email
            global.storage.getUserByEmailPassword(req.body.email, Users.hashPassword(req.body.password)).then(function(user) {
              // Found?
              if (user) {
                // Get authorisation
                let userRole = Authorization.getAuthorizationFromRoleID(user.getRole());
                // Parse the auth and replace values
                var parsedAuths = Mustache.render(JSON.stringify(userRole.auths), {"user": user.getModel()});
                // Compile auths of the role
                var compiledAuths = compileProfile(JSON.parse(parsedAuths));
                // Yes: build payload
                var payload = {
                    id: user.getID(),
                    name: user.getName(),
                    firstName: user.getFirstName(),
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
                // User not found
                res.sendStatus(401);
              }
              next();
            }).catch((err) => {
              // Error
              res.sendStatus(500);
              next();
            });
            break;

            // Register User
            case "registeruser":
              // Check Mandatory fields
              if (Users.checkIfUserValid(req, res, next)) {
                // Check email
                global.storage.getUserByEmail(req.body.email).then(function(user) {
                  if (user) {
                    Logging.logActionErrorMessageAndSendResponse(action, `The email ${req.body.tagIDs} already exists`, req, res, next);
                    return;
                  }
                  // Create the user
                  var newUser = new User(req.body);
                  // Hash the password
                  newUser.setPassword(Users.hashPassword(newUser.getPassword()));
                  // Save
                  newUser.save().then(() => {
                    // Send the email
                    EMail.sendRegisteredUserEmail({
                          "user": newUser.getModel(),
                          "evseDashboardURL" : Utils.buildEvseURL()
                        }, req.locale).then(
                      message => {
                        // Success
                        Logging.logInfo({
                          userFullName: "System", source: "Central Server", module: "CentralServerRestAuthentication", method: "registeruser",
                          action: "RegisterUser", message: `User ${newUser.getFullName()} with email ${newUser.getEMail()} has been registered successfully`,
                          detailedMessages: newUser});
                        // Ok
                        res.json({status: `Success`});
                        next();
                      },
                      error => {
                        // Error
                        Logging.logError({
                          userFullName: "System", source: "Central Server", module: "CentralServerRestAuthentication", method: "N/A",
                          action: "RegisterUser", message: `${error.toString()}`,
                          detailedMessages: error.stack });
                        res.json({error: error.toString()});
                        next();
                      });
                    });
                }).catch((err) => {
                  // Log
                  Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
                });
              }
              break;

            // Reset password
            case "reset":
              // Generate a new password
              global.storage.getUserByEmail(req.body.email).then((user) => {
                // Found?
                if (user) {
                  // Yes: Generate new password
                  let newPassword = Users.generatePassword();
                  // Hash it
                  user.setPassword(Users.hashPassword(newPassword));
                  // Save the user
                  user.save().then(() => {
                    // Send the email
                    EMail.sendResetPasswordEmail({
                      "user": user.getModel(),
                      "newPassword": newPassword,
                      "evseDashboardURL" : Utils.buildEvseURL()
                    }, req.locale).then(
                      message => {
                        // Success
                        Logging.logInfo({
                          user: req.user, source: "Central Server", module: "CentralServerRestAuthentication", method: "N/A",
                          action: "ResetPassword", message: `Password has been reset for user with email ${user.getEMail()}`,
                          detailedMessages: message });
                        // Ok
                        res.json({status: `Success`});
                        next();
                      },
                      error => {
                        // Error
                        Logging.logError({
                          user: req.user, source: "Central Server", module: "CentralServerRestAuthentication", method: "N/A",
                          action: "ResetPassword", message: `${error.toString()}`,
                          detailedMessages: error.stack });
                        res.json({error: error.toString()});
                        next();
                      });
                  });
                } else {
                  // User not found
                  res.status(500).send(`User with email ${req.body.email} does not exist`);
                  next();
                }
              }).catch((err) => {
                // User not found
                res.status(500).send(`${err.toString()}`);
                next();
              });
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
  }
};
