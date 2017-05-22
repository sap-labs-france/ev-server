var passport = require('passport');
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var jwt = require('jsonwebtoken');
var Users = require('../utils/Users');
var EMail = require('../email/EMail');
var Logging = require('../utils/Logging');
var User = require('../model/User');

// Init JWT auth options
var jwtOptions = {
  secretOrKey: 's3A92797boeiBhxQDM1GInRith',
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
                // Yes: build payload
                var payload = {
                    id: user.getID(),
                    name: user.getName(),
                    firstName: user.getFirstName(),
                    role: user.getRole()
                };
                // Build token
                var token = jwt.sign(payload, jwtOptions.secretOrKey, {
                  expiresIn: 12*3600 // 12h
                });
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
                    Logging.logActionErrorMessageAndSendResponse(`The email ${req.body.tagIDs} already exists`, req, res, next);
                    return;
                  }
                  // Create the user
                  var newUser = new User(req.body);
                  // Hash the password
                  newUser.setPassword(Users.hashPassword(newUser.getPassword()));
                  // Save
                  newUser.save().then(() => {
                    Logging.logInfo({
                      source: "Central Server", module: "ServerRestAuthentication", method: "registeruser",
                      message: `User ${newUser.getFullName()} with email ${newUser.getEMail()} has been created successfully`,
                      detailedMessages: user});
                  });
                  res.json({status: `Success`});
                  next();

                }).catch((err) => {
                  // Log
                  Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
                });
              }
              break;

            // Reset password
            case "reset":
              // Generate a new password
              global.storage.getUserByEmail(req.body.email).then(function(user) {
                // Found?
                if (user) {
                  // Yes: Generate new password
                  let newPassword = Users.generatePassword();
                  console.log(newPassword);
                  // Hash it
                  user.setPassword(Users.hashPassword(newPassword));
                  // Save the user
                  user.save().then(() => {
                    // Send the email
                    new EMail().sendEmail({
                        to: req.body.email,
                        subject: "EVSE - Your passord has been reset",
                        text: `HTML content`,
                        html:
                          `
                            Hi ${user.getFirstName()},

                            Your password to access the EVSE-Dashboard has been reset successfully!

                            Your new password is: <bold>${newPassword}</bold>

                            Best Regards,
                            EVSE Admin.
                          `
                      }).then((message) => {

                        Logging.logInfo({
                          source: "Central Server", module: "CentralSystemServer", method: "N/A",
                          action: "ResetPassword",
                          message: `Reset password done for user with email ${req.body.email}`,
                          detailedMessages: message });
                        // Ok
                        res.json({status: `Success`});
                        next();
                      }, error => {
                        // Ok
                        Logging.logError({
                          source: "Central Server", module: "CentralSystemServer", method: "N/A",
                          action: "ResetPassword",
                          message: `${error.toString()}`,
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
              Logging.logActionErrorMessageAndSendResponse(`No Action has been provided`, req, res, next);
            } else {
              // Log
              Logging.logActionErrorMessageAndSendResponse(`The Action '${action}' does not exist`, req, res, next);
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
