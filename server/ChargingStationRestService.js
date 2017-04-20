var Utils = require('../utils/Utils');
var Logging = require('../utils/Logging');
var Users = require('../utils/Users');
var User = require('../model/User');

// Log issues
var logActionUnexpectedErrorMessageAndSendResponse = function(action, err, req, res, next) {
  Logging.logError({
    source: "Central Server", module: "ChargingStationRestService", method: "N/A",
    action: action,
    message: `Unexpected Error: ${err.toString()}`,
    detailedMessages: err.stack });
  res.json({error: `Unexpected Error: ${err.toString()}`});
  next();
}

// Log issues
var logActionErrorMessageAndSendResponse = function(message, req, res, next) {
  Logging.logError({
    source: "Central Server", module: "ChargingStationRestService", method: "N/A",
    message: message,
    detailedMessages: [{
        "stack": new Error().stack,
        "request": req.body}] });
  res.json({error: message});
  next();
}

var checkIfUserValid = function(req, res, next) {
  // Update mode?
  if(req.method === "PUT" && !req.body.id) {
    logActionErrorMessageAndSendResponse(`The user's ID is mandatory`, req, res, next);
    return false;
  }
  if(!req.body.name) {
    logActionErrorMessageAndSendResponse(`The user's last name is mandatory`, req, res, next);
    return false;
  }
  if(!req.body.firstName) {
    logActionErrorMessageAndSendResponse(`The user's first name is mandatory`, req, res, next);
    return false;
  }
  if(!req.body.email) {
    logActionErrorMessageAndSendResponse(`The user's email is mandatory`, req, res, next);
    return false;
  }
  if(!req.body.status) {
    logActionErrorMessageAndSendResponse(`The user's status is mandatory`, req, res, next);
    return false;
  }
  // Check format
  if (!Users.isUserNameValid(req.body.name)) {
    logActionErrorMessageAndSendResponse(`The user's last name ${req.body.name} is not valid`, req, res, next);
    return false;
  }
  if (!Users.isUserNameValid(req.body.firstName)) {
    logActionErrorMessageAndSendResponse(`The user's first name ${req.body.firstName} is not valid`, req, res, next);
    return false;
  }
  if (!Users.isUserEmailValid(req.body.email)) {
    logActionErrorMessageAndSendResponse(`The user's email ${req.body.email} is not valid`, req, res, next);
    return false;
  }
  if (req.body.phone && !Users.isPhoneValid(req.body.phone)) {
    logActionErrorMessageAndSendResponse(`The user's phone ${req.body.phone} is not valid`, req, res, next);
    return false;
  }
  if (req.body.mobile && !Users.isPhoneValid(req.body.mobile)) {
    logActionErrorMessageAndSendResponse(`The user's mobile ${req.body.mobile} is not valid`, req, res, next);
    return false;
  }
  if (req.body.iNumber && !Users.isINumberValid(req.body.iNumber)) {
    logActionErrorMessageAndSendResponse(`The user's I-Number ${req.body.iNumber} is not valid`, req, res, next);
    return false;
  }
  if (req.body.tagIDs) {
    // Check
    if (!Users.isTagIDValid(req.body.tagIDs)) {
      logActionErrorMessageAndSendResponse(`The user's tags ${req.body.tagIDs} is/are not valid`, req, res, next);
      return false;
    }
    // Check
    if (!Array.isArray(req.body.tagIDs)) {
      // Split
      req.body.tagIDs = req.body.tagIDs.split(',');
    }
  } else {
    // Default
    req.body.tagIDs = [];
  }
  // Ok
  return true;
}

module.exports = function(req, res, next) {
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
        case "Reset":
          // Get the Charging Station
          if (req.body.chargeBoxIdentity) {
            // Get the Charging station
            global.storage.getChargingStation(req.body.chargeBoxIdentity).then(function(chargingStation) {
              // Found?
              if (chargingStation) {
                // Execute it
                return chargingStation.handleAction(action, req.body.args);
              } else {
                // Charging station not found
                logActionErrorMessageAndSendResponse(`Charging Station not found with ID ${req.body.chargeBoxIdentity}`, req, res, next);
              }
            }).then(function(result) {
              // Return the result
              res.json(result);
              next();

            }).catch(function(err) {
              // Log
              logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
          } else {
            // Log
            logActionErrorMessageAndSendResponse(`The Charging Station's ID must be provided`, req, res, next);
          }
          break;

        // Create User
        case "CreateUser":
          // Check Mandatory fields
          if (checkIfUserValid(req, res, next)) {
            // Check email
            global.storage.getUserByEmail(req.body.email).then(function(user) {
              if (user) {
                logActionErrorMessageAndSendResponse(`The user's email ${req.body.tagIDs} is already taken`, req, res, next);
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
              logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
          }
          break;

        // Unknown Context
        default:
          // Action provided
          if (!action) {
            // Log
            logActionErrorMessageAndSendResponse(`No Action has been provided`, req, res, next);
          } else {
            // Log
            logActionErrorMessageAndSendResponse(`The Action '${action}' does not exist`, req, res, next);
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
          logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
        });
        break;

      // Get one charging station
      case "ChargingStation":
        global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
          var chargingStationJSon = {};
          if (chargingStation) {
            // Set the model
            chargingStationJSon = chargingStation.getModel();
          }
          // Return
          res.json(chargingStationJSon);
          next();
        }).catch((err) => {
          // Log
          logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
        });
        break;

      // Get all the users
      case "Users":
        global.storage.getUsers().then(function(users) {
          var usersJSon = [];
          users.forEach(function(user) {
            // Set the model
            usersJSon.push(user.getModel());
          });
          // Return
          res.json(usersJSon);
          next();
        }).catch((err) => {
          // Log
          logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
        });
        break;

      // Get the user
      case "UserByEmail":
        global.storage.getUserByEmail(req.query.Email).then(function(user) {
          var userJSon = {};
          if (user) {
            // Set the model
            userJSon = user.getModel();
          }
          // Return
          res.json(userJSon);
          next();
        }).catch((err) => {
          // Log
          logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
        });
        break;

      // Get the user
      case "User":
        global.storage.getUser(req.query.ID).then(function(user) {
          var userJSon = {};
          if (user) {
            // Set the model
            userJSon = user.getModel();
          }
          // Return
          res.json(userJSon);
          next();
        }).catch((err) => {
          // Log
          logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
        });
        break;

      // Get the user
      case "UserByTagId":
        global.storage.getUserByTagId(req.query.TagId).then(function(user) {
          var userJSon = {};
          if (user) {
            // Set the model
            userJSon = user.getModel();
          }
          // Return
          res.json(userJSon);
          next();
        }).catch((err) => {
          // Log
          logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
        });
        break;

      // Get the transactions
      case "Transactions":
        global.storage.getTransactions(
            req.query.ChargeBoxIdentity,
            req.query.ConnectorId,
            req.query.StartDateTime,
            req.query.EndDateTime).then(function(transactions) {
          // Return
          res.json(transactions);
          next();
        }).catch((err) => {
          // Log
          logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
        });
        break;

      // Get all the Status Notifications
      case "StatusNotifications":
        // Charging Station found?
        if (req.query.ChargeBoxIdentity) {
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
              // Return the result
              res.json(statusNotifications);
              next();
            }
          }).catch((err) => {
            // Log
            logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
        } else {
          global.storage.getStatusNotifications().then(function(statusNotifications) {
            // Return the result
            res.json(statusNotifications);
            next();
          });
        }
        break;

      // Get the last Status Notifications
      case "LastStatusNotifications":
        // Charging Station found?
        if (req.query.ChargeBoxIdentity) {
          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let statusNotifications = {};
            // Found
            if (chargingStation) {
              // Get the Status
              chargingStation.getLastStatusNotification(req.query.ConnectorId).then(function(statusNotification) {
                // Return the result
                res.json(statusNotification);
                next();
              });
            } else {
              // Return the result
              res.json(statusNotification);
              next();
            }
          }).catch((err) => {
            // Log
            logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
        }
        break;

      // Get Charging Consumption
      case "ChargingStationConsumption":
        // Get the Charging Station`
        global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
          let consumptions = [];

          // Found
          if (chargingStation) {
            // Get the Consumption
            chargingStation.getConsumptions(
                req.query.ConnectorId,
                req.query.TransactionId,
                req.query.StartDateTime,
                req.query.EndDateTime).then(function(consumptions) {

              // Return the result
              res.json(consumptions);
              next();
            });
          } else {
            // Return the result
            res.json(consumptions);
            next();
          }
        }).catch((err) => {
          // Log
          logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
        });
        break;

      // Get Charging Consumption
      case "ChargingStationConfiguration":
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
            // Return the result
            res.json(configuration);
            next();
          }
        }).catch((err) => {
          // Log
          logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
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
          logActionErrorMessageAndSendResponse(`No Action has been provided`, req, res, next);
        } else {
          // Log
          logActionErrorMessageAndSendResponse(`The Action '${action}' does not exist`, req, res, next);
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
        if (checkIfUserValid(req, res, next)) {
          // Check email
          global.storage.getUser(req.body.id).then(function(user) {
            if (!user) {
              logActionErrorMessageAndSendResponse(`The user with ID ${req.body.id} does not exist anymore`, req, res, next);
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
            logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
        }
        break;

        // Not found
      default:
        // Action provided
        if (!action) {
          // Log
          logActionErrorMessageAndSendResponse(`No Action has been provided`, req, res, next);
        } else {
          // Log
          logActionErrorMessageAndSendResponse(`The Action '${action}' does not exist`, req, res, next);
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
            logActionErrorMessageAndSendResponse(`The user's ID must be provided`, req, res, next);
            return;
          }
          // Check email
          global.storage.getUser(req.query.ID).then(function(user) {
            if (!user) {
              logActionErrorMessageAndSendResponse(`The user with ID ${req.body.id} does not exist anymore`, req, res, next);
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
            logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

          // Not found
        default:
          // Action provided
          if (!action) {
            // Log
            logActionErrorMessageAndSendResponse(`No Action has been provided`, req, res, next);
          } else {
            // Log
            logActionErrorMessageAndSendResponse(`The Action '${action}' does not exist`, req, res, next);
          }
          break;
      }
      break;

  default:
    // Log
    logActionErrorMessageAndSendResponse(`Ussuported request method ${req.method}`, req, res, next);
    break;
  }
};
