var Utils = require('../utils/Utils');
var Logging = require('../utils/Logging');
const Users = require('../utils/Users');
var User = require('../model/User');

module.exports = {
  // Util Service
  restServiceUtil(req, res, next) {
    // Parse the action
    var action = /^\/\w*/g.exec(req.url)[0].substring(1);
    // Check Context
    switch (req.method) {
      // Create Request
      case "GET":
        // Check Context
        switch (action) {
          // Ping
          case "ping":
            res.sendStatus(200);
            break;

          // Check email
          case "checkemail":
            // Check email
            global.storage.getUserByEmail(req.query.EMail).then((user) => {
              // Found?
              if (user) {
                // Ok
                res.json({exist: true});
              } else {
                // Ok
                res.json({exist: false});
              }
              next();
            }).catch((err) => {
              // Error
              res.status(500).send(`${err.toString()}`);
              next();
            });
            break;
        }
        break;
    }
  },

  restServiceSecured(req, res, next) {
    // Parse the action
    var action = /^\/\w*/g.exec(req.url)[0].substring(1);
    // Check Context
    switch (req.method) {
      // Create Request
      case "POST":
        // Check Context
        switch (action) {
          // Charge Box
          case "ClearCache":
          case "GetConfiguration":
          case "StopTransaction":
          case "UnlockConnector":
          case "Reset":
            // Charge Box is mandatory
            if(!req.body.chargeBoxIdentity) {
              Utils.logActionErrorMessageAndSendResponse(`The Charging Station ID is mandatory`, req, res, next);
              break;
            }
            // Get the Charging station
            global.storage.getChargingStation(req.body.chargeBoxIdentity).then(function(chargingStation) {
              // Found?
              if (chargingStation) {
                // Execute it
                return chargingStation.handleAction(action, req.body.args);
              } else {
                // Charging station not found
                Utils.logActionErrorMessageAndSendResponse(`Charging Station with ID ${req.body.chargeBoxIdentity} does not exist`, req, res, next);
              }
            }).then(function(result) {
              // Return the result
              res.json(result);
              next();

            }).catch(function(err) {
              // Log
              Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
            break;

          // Create User
          case "CreateUser":
            // Check Mandatory fields
            if (Users.checkIfUserValid(req, res, next)) {
              // Check email
              global.storage.getUserByEmail(req.body.email).then(function(user) {
                if (user) {
                  Utils.logActionErrorMessageAndSendResponse(`The email ${req.body.tagIDs} already exists`, req, res, next);
                  return;
                }

                // Check Badge ID
                var newUser = new User(req.body);
                // Save
                newUser.save().then(() => {
                  Logging.logInfo({
                    source: "Central Server", module: "ChargingStationBackgroundTasks", method: "checkAndSaveUser",
                    message: `User ${newUser.getFullName()} with email ${newUser.getEMail()} has been created successfully`,
                    detailedMessages: user});
                });
                res.json({status: `Success`});
                next();

              }).catch((err) => {
                // Log
                Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
              });
            }
            break;

          // Unknown Context
          default:
            // Action provided
            if (!action) {
              // Log
              Utils.logActionErrorMessageAndSendResponse(`No Action has been provided`, req, res, next);
            } else {
              // Log
              Utils.logActionErrorMessageAndSendResponse(`The Action '${action}' does not exist`, req, res, next);
            }
            next();
        }
        break;

    // Get Request
    case "GET":
      // Check Action
      switch (action) {
        // Get the Logging
        case "Logging":
          Logging.getLogs(100).then(function(loggings) {
            // Return
            res.json(loggings);
            next();
          });
          break;

        // Get all the charging stations
        case "ChargingStations":
          global.storage.getChargingStations("RestService").then(function(chargingStations) {
            var chargingStationsJSon = [];
            chargingStations.forEach(function(chargingStation) {
              // Set the model
              chargingStationsJSon.push(chargingStation.getModel());
            });
            // Return
            res.json(chargingStationsJSon);
            next();
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get one charging station
        case "ChargingStation":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Utils.logActionErrorMessageAndSendResponse(`The Charging Station ID is mandatory`, req, res, next);
            break;
          }

          // Get it
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            if (chargingStation) {
              res.json(chargingStation.getModel());
            } else {
              res.json({});
            }
            next();
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get all the users
        case "Users":
          global.storage.getUsers().then(function(users) {
            var usersJSon = [];
            users.forEach(function(user) {
              // Clear password
              user.setPassword("");
              // Set the model
              usersJSon.push(user.getModel());
            });
            // Return
            res.json(usersJSon);
            next();
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the user
        case "UserByEmail":
          // User mandatory
          if(!req.query.Email) {
            Utils.logActionErrorMessageAndSendResponse(`The User's email is mandatory`, req, res, next);
            break;
          }
          // Get
          global.storage.getUserByEmail(req.query.Email).then(function(user) {
            if (user) {
              // Clear password
              user.setPassword("");
              // Set
              res.json(user.getModel());
            } else {
              res.json({});
            }
            next();
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the user
        case "User":
          // User mandatory
          if(!req.query.ID) {
            Utils.logActionErrorMessageAndSendResponse(`The User's ID is mandatory`, req, res, next);
            break;
          }
          global.storage.getUser(req.query.ID).then(function(user) {
            if (user) {
              // Clear password
              user.setPassword("");
              // Set the user
              res.json(user.getModel());
            } else {
              res.json({});
            }
            next();
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the user
        case "UserByTagId":
          // User mandatory
          if(!req.query.TagId) {
            Utils.logActionErrorMessageAndSendResponse(`The User's Tag ID is mandatory`, req, res, next);
            break;
          }
          // Set
          global.storage.getUserByTagId(req.query.TagId).then(function(user) {
            if (user) {
              // Clear password
              user.setPassword("");
              // Set data
              res.json(user.getModel());
            } else {
              res.json({});
            }
            next();
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the transactions
        case "Transactions":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Utils.logActionErrorMessageAndSendResponse(`The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          // Connector Id is mandatory
          if(!req.query.ConnectorId) {
            Utils.logActionErrorMessageAndSendResponse(`The Connector ID is mandatory`, req, res, next);
            break;
          }

          // Get Charge Box
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            if (chargingStation) {
              // Set the model
              chargingStation.getTransactions(req.query.ConnectorId,
                req.query.StartDateTime, req.query.EndDateTime).then((transactions) => {
                  // Return
                  res.json(transactions);
                  next();
                });
            } else {
              // Log
              return Promise.reject(new Error(`Charging Station ${req.query.ChargeBoxIdentity} does not exist`));
            }
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the last transaction
        case "LastTransaction":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Utils.logActionErrorMessageAndSendResponse(`The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          // Connector Id is mandatory
          if(!req.query.ConnectorId) {
            Utils.logActionErrorMessageAndSendResponse(`The Connector ID is mandatory`, req, res, next);
            break;
          }

          // Get Charge Box
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            if (chargingStation) {
              // Set the model
              chargingStation.getLastTransaction(req.query.ConnectorId).then((transaction) => {
                // Return
                res.json(transaction);
                next();
              });
            } else {
              // Log
              return Promise.reject(new Error(`Charging Station ${req.query.ChargeBoxIdentity} does not exist`));
            }
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get all the Status Notifications
        case "StatusNotifications":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Utils.logActionErrorMessageAndSendResponse(`The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          // Charging Station Provided?
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let statusNotifications = [];
            // Found
            if (chargingStation) {
              // Yes: Get the Status
              chargingStation.getStatusNotifications(req.query.ConnectorId).then(function(statusNotifications) {
                // Return the result
                res.json(statusNotifications);
                next();
              });
            } else {
              // Log
              return Promise.reject(new Error(`Charging Station ${req.query.ChargeBoxIdentity} does not exist`));
            }
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the last Status Notifications
        case "LastStatusNotification":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Utils.logActionErrorMessageAndSendResponse(`The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          if(!req.query.ConnectorId) {
            Utils.logActionErrorMessageAndSendResponse(`The Connector ID is mandatory`, req, res, next);
            break;
          }
          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let statusNotifications = {};
            // Found?
            if (chargingStation) {
              // Get the Status
              chargingStation.getLastStatusNotification(req.query.ConnectorId).then(function(statusNotification) {
                // Found?
                if (statusNotification) {
                  // Return the result
                  res.json(statusNotification);
                  next();
                } else {
                  // Log
                  return Promise.reject(new Error(`Status for Charging Station ${req.query.ChargeBoxIdentity} with Connector ID ${req.query.ConnectorId} does not exist`));
                }
              });
            } else {
              // Log
              return Promise.reject(new Error(`Charging Station ${req.query.ChargeBoxIdentity} does not exist`));
            }
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get Charging Consumption
        case "ChargingStationConsumption":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Utils.logActionErrorMessageAndSendResponse(`The Charging Station ID is mandatory`, req, res, next);
            break;
          }

          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let consumptions = [];

            // Found
            if (chargingStation) {
              // Get the Consumption
              chargingStation.getConsumptions(
                  req.query.ConnectorId,
                  req.query.StartDateTime,
                  req.query.EndDateTime).then(function(consumptions) {

                // Return the result
                res.json(consumptions);
                next();
              });
            } else {
              // Log
              return Promise.reject(new Error(`Charging Station ${req.query.ChargeBoxIdentity} does not exist`));
            }
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get Charging Consumption
        case "ChargingStationConfiguration":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Utils.logActionErrorMessageAndSendResponse(`The Charging Station ID is mandatory`, req, res, next);
            break;
          }

          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let configuration = {};

            // Found
            if (chargingStation) {
              // Get the Config
              chargingStation.getConfiguration().then(function(configuration) {
                // Return the result
                res.json(configuration);
                next();
              });
            } else {
              // Log
              return Promise.reject(new Error(`Charging Station ${req.query.ChargeBoxIdentity} does not exist`));
            }
          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the Settings
        case "Settings":
          // Return the result
          res.json(Utils.getConfig());
          next();
          break;

        // Unknown Action
        default:
          // Action provided
          if (!action) {
            // Log
            Utils.logActionErrorMessageAndSendResponse(`No Action has been provided`, req, res, next);
          } else {
            // Log
            Utils.logActionErrorMessageAndSendResponse(`The Action '${action}' does not exist`, req, res, next);
          }
      }
      break;

    // Update Request
    case "PUT":
      // Check
      switch (action) {
        // User
        case "UpdateUser":
          // Check Mandatory fields
          if (Users.checkIfUserValid(req, res, next)) {
            // Check email
            global.storage.getUser(req.body.id).then(function(user) {
              if (!user) {
                Utils.logActionErrorMessageAndSendResponse(`The user with ID ${req.body.id} does not exist anymore`, req, res, next);
                return;
              }

              // Update
              Utils.updateUser(req.body, user.getModel());

              // Update
              user.save().then(() => {
                Logging.logInfo({
                  source: "Central Server", module: "ChargingStationBackgroundTasks", method: "checkAndSaveUser",
                  message: `User ${user.getFullName()} with Email ${user.getEMail()} has been updated successfully`,
                  detailedMessages: user});
              });
              res.json({status: `Success`});
              next();

            }).catch((err) => {
              // Log
              Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
          }
          break;

        // User
        case "ChangeUserPassword":
          // Get user
          global.storage.getUser(req.user.id).then(function(user) {
            if (!user) {
              Utils.logActionErrorMessageAndSendResponse(`The user with ID ${req.user.id} does not exist anymore`, req, res, next);
              return;
            }

            // Hash the pass
            let passwordHashed = Users.hashPassword(req.body.password);

            // Update the password
            user.setPassword(passwordHashed);

            // Save
            user.save().then(() => {
              Logging.logInfo({
                source: "Central Server", module: "ChargingStationBackgroundTasks", method: "ChangeUserPassword",
                message: `The password of the User ${user.getFullName()} has been updated successfully`});
            });
            res.json({status: `Success`});
            next();

          }).catch((err) => {
            // Log
            Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

          // Not found
        default:
          // Action provided
          if (!action) {
            // Log
            Utils.logActionErrorMessageAndSendResponse(`No Action has been provided`, req, res, next);
          } else {
            // Log
            Utils.logActionErrorMessageAndSendResponse(`The Action '${action}' does not exist`, req, res, next);
          }
          break;
      }
      break;

      // Delete Request
      case "DELETE":
        // Check
        switch (action) {
          // User
          case "DeleteUser":
            // Check Mandatory fields
            if(!req.query.ID) {
              Utils.logActionErrorMessageAndSendResponse(`The user's ID must be provided`, req, res, next);
              return;
            }
            // Check email
            global.storage.getUser(req.query.ID).then(function(user) {
              if (!user) {
                Utils.logActionErrorMessageAndSendResponse(`The user with ID ${req.body.id} does not exist anymore`, req, res, next);
                return;
              }
              // Delete
              global.storage.deleteUser(req.query.ID).then(() => {
                // Log
                Logging.logInfo({
                  source: "Central Server", module: "ChargingStationBackgroundTasks", method: "checkAndSaveUser",
                  message: `User ${user.getFullName()} with Email ${user.getEMail()} has been deleted successfully`,
                  detailedMessages: user});
                // Ok
                res.json({status: `Success`});
                next();
              });
            }).catch((err) => {
              // Log
              Utils.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
            break;

            // Not found
          default:
            // Action provided
            if (!action) {
              // Log
              Utils.logActionErrorMessageAndSendResponse(`No Action has been provided`, req, res, next);
            } else {
              // Log
              Utils.logActionErrorMessageAndSendResponse(`The Action '${action}' does not exist`, req, res, next);
            }
            break;
        }
        break;

    default:
      // Log
      Utils.logActionErrorMessageAndSendResponse(`Ussuported request method ${req.method}`, req, res, next);
      break;
    }
  }
};
