var Utils = require('../utils/Utils');

module.exports = function(req, res, next) {
  console.log(`/client/api: ${req.method} request for '${req.url}' - ${JSON.stringify(req.body)}`);

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
      console.log(result);
      next();

    }).catch(function(err) {
      // Return the error
      if (err.message) {
        res.json({error: err.message});
      } else {
        res.json({error: err});
      }
      console.log(err);
      next();
    });

    // Get data
  } else if (req.method === "GET") {
    var action = /^\/\w*/g.exec(req.url)[0].substring(1);
    // Check Action
    switch (action) {
      // Get all the charging stations
      case "ChargingStations":
        global.storage.getChargingStations().then(function(chargingStations) {
          var chargingStationsJSon = [];
          chargingStations.forEach(function(chargingStation) {
            // Set the model
            chargingStationsJSon.push(chargingStation.getModel());
          });

          // Return the error
          res.json(chargingStationsJSon);
          next();
        });
        break;

      // Get one charging station
      case "ChargingStation":
        global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
          var chargingStationsJSon = [];

          if (chargingStation) {
            // Set the model
            chargingStationsJSon = chargingStation.getModel();
          }

          // Return the error
          res.json(chargingStationsJSon);
          next();
        });
        break;

      // Get all the Status Notifications
      case "StatusNotifications":
        // Charging Station found?
        if (req.query.ChargeBoxIdentity) {
          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let statusNotifications = {};

            // Found
            if (chargingStation) {
              // Get the Status
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
          });
        } else {
          global.storage.getStatusNotifications().then(function(statusNotifications) {
            // Return the result
            res.json(statusNotifications);
            next();
          });
        }
        break;

      // Get all the Status Notifications
      case "LastStatusNotifications":
        // Charging Station found?
        if (req.query.ChargeBoxIdentity) {
          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let statusNotifications = {};

            // Found
            if (chargingStation) {
              // Get the Status
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
          });
        } else {
          global.storage.getStatusNotifications().then(function(statusNotifications) {
            // Return the result
            res.json(statusNotifications);
            next();
          });
        }
        break;

      // Get Charging Consumption
      case "ChargingStationConsumption":
        // Get the Charging Station`
        global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
          let consumptions = {};

          // Found
          if (chargingStation) {
            // Get the Consumption
            chargingStation.getConsumptions(
                req.query.ConnectorId,
                req.query.TransactionId,
                req.query.StartDateTime,
                req.query.EndtDateTime).then(function(consumptions) {

              // Return the result
              res.json(consumptions);
              next();
            });
          } else {
            // Return the result
            res.json(consumptions);
            next();
          }
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
        res.json({error: `Action '${action}' does not exist`});
        next();
    }
  }
};
