var Utils = require('../utils/Utils');
var Logging = require('../utils/Logging');

// Log issues
var logActionErrorMessage = function(action, err, res, next) {
  Logging.logError({
    source: "Central Server", module: "ChargingStationRestService", method: "N/A",
    action: action,
    message: `Unexpected Error: ${err.toString()}`,
    detailedMessages: err.stack });
  res.json({error: `Unexpected Error: ${err.toString()}`});
  next();
}

module.exports = function(req, res, next) {
  // Action on ChargeBox
  if (req.method === "POST") {
    // Yes: Get the Charging station
    global.storage.getChargingStation(req.body.chargeBoxIdentity).then(function(chargingStation) {
      // Found?
      if (chargingStation) {
        // Execute it
        return chargingStation.handleAction(req.body.action, req.body.args);
      } else {
         // Charging station not found
         res.json(`{error: Charging station not found with ID ${req.body.chargeBoxIdentity}}`);
         next();
      }

    }).then(function(result) {
      // Return the result
      res.json(result);
      next();

    }).catch(function(err) {
      // Log
      logActionErrorMessage(action, err, res, next);
    });

    // Get data
  } else if (req.method === "GET") {
    var action = /^\/\w*/g.exec(req.url)[0].substring(1);
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
          logActionErrorMessage(action, err, res, next);
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
          logActionErrorMessage(action, err, res, next);
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
          logActionErrorMessage(action, err, res, next);
        });
        break;

      // Get the user
      case "User":
        global.storage.getUser(req.query.TagId).then(function(user) {
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
          logActionErrorMessage(action, err, res, next);
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
          logActionErrorMessage(action, err, res, next);
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
            logActionErrorMessage(action, err, res, next);
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
            logActionErrorMessage(action, err, res, next);
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
          logActionErrorMessage(action, err, res, next);
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
          logActionErrorMessage(action, err, res, next);
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
        // Log
        Logging.logError({
          source: "Central Server", module: "ChargingStationRestService", method: "N/A",
          message: `Action '${action}' does not exist` });
        res.json({error: `Action '${action}' does not exist`});
        next();
    }
  }
};
