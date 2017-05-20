var passport = require('passport');
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var jwt = require('jsonwebtoken');
var Users = require('../utils/Users');
var EMail = require('../email/EMail');
var Logging = require('../utils/Logging');

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

          default:

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
              new EMail().sendTextEmail({
                  text: "Text",
                  from: "evse.dashboard@sap.com",
                  to: req.body.email,
                  subject: "EVSE - Your passord has been reset"
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
