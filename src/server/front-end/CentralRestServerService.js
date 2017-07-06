var CentralRestServerAuthorization = require('./CentralRestServerAuthorization');
var Utils = require('../../utils/Utils');
var Database = require('../../utils/Database');
var Logging = require('../../utils/Logging');
const Users = require('../../utils/Users');
var User = require('../../model/User');

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
          case "ChargingStationSetMaxIntensitySocket":
            // Charge Box is mandatory
            if(!req.body.chargeBoxIdentity) {
              Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
              break;
            }
            // Get the Charging station
            global.storage.getChargingStation(req.body.chargeBoxIdentity).then((chargingStation) => {
              // Found?
              if (chargingStation) {
                // Check auth
                if (!CentralRestServerAuthorization.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), "ChangeConfiguration")) {
                  // Not Authorized!
                  Logging.logActionUnauthorizedMessageAndSendResponse(
                    CentralRestServerAuthorization.ENTITY_CHARGING_STATION, action, req, res, next);
                  return;
                }
                // Get the configuration
                // Get the Config
                return chargingStation.getConfiguration().then((chargerConfiguration) => {
                  // Check
                  if (chargerConfiguration) {
                    let maxIntensitySocketMax = null;
                    // Fill current params
                    for (let i = 0; i < chargerConfiguration.configuration.length; i++) {
                      // Max Intensity?
                      if (chargerConfiguration.configuration[i].key.startsWith("currentpb")) {
                        // Set
                        maxIntensitySocketMax = Number(chargerConfiguration.configuration[i].value);
                      }
                    }
                    if (maxIntensitySocketMax) {
                      // Check
                      if (req.body.args.maxIntensity && req.body.args.maxIntensity >= 0 && req.body.args.maxIntensity <= maxIntensitySocketMax) {
                        // Log
                        Logging.logInfo({
                          user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
                          message: `Change Max Instensity Socket of Charging Station '${req.body.chargeBoxIdentity}' to ${req.body.args.maxIntensity}`});

                          // Change the config
                          return chargingStation.requestChangeConfiguration('maxintensitysocket', req.body.args.maxIntensity);
                      } else {
                        // Invalid value
                        Logging.logActionErrorMessageAndSendResponse(action, `Invalid value for param max intensity socket '${req.body.maxIntensity}' for Charging Station ${req.body.chargeBoxIdentity}`, req, res, next);
                      }
                    } else {
                      // Charging station not found
                      Logging.logActionErrorMessageAndSendResponse(action, `Cannot retrieve the max intensity socket from the configuration of the Charging Station ${req.body.chargeBoxIdentity}`, req, res, next);
                    }
                  } else {
                    // Charging station not found
                    Logging.logActionErrorMessageAndSendResponse(action, `Cannot retrieve the configuration of the Charging Station ${req.body.chargeBoxIdentity}`, req, res, next);
                  }
                });
              } else {
                // Charging station not found
                Logging.logActionErrorMessageAndSendResponse(action, `Charging Station with ID ${req.body.chargeBoxIdentity} does not exist`, req, res, next);
              }
            }).then(function(result) {
              // Return the result
              res.json(result);
              next();
            }).catch(function(err) {
              // Log
              Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
            break;

          // Charge Box
          case "ChargingStationClearCache":
          case "ChargingStationGetConfiguration":
          case "ChargingStationChangeConfiguration":
          case "ChargingStationStopTransaction":
          case "ChargingStationUnlockConnector":
          case "ChargingStationReset":
            // Keep the action
            action = action.slice(15);
            // Charge Box is mandatory
            if(!req.body.chargeBoxIdentity) {
              Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
              break;
            }
            // Get the Charging station
            global.storage.getChargingStation(req.body.chargeBoxIdentity).then((chargingStation) => {
              // Found?
              if (chargingStation) {
                // Check auth
                if (!CentralRestServerAuthorization.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), action)) {
                  // Not Authorized!
                  Logging.logActionUnauthorizedMessageAndSendResponse(
                    CentralRestServerAuthorization.ENTITY_CHARGING_STATION, action, req, res, next);
                  return;
                }
                // Log
                Logging.logInfo({
                  user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
                  message: `Execute action '${action}' on Charging Station '${req.body.chargeBoxIdentity}'`});
                // Execute it
                return chargingStation.handleAction(action, req.body.args);
              } else {
                // Charging station not found
                Logging.logActionErrorMessageAndSendResponse(action, `Charging Station with ID ${req.body.chargeBoxIdentity} does not exist`, req, res, next);
              }
            }).then(function(result) {
              // Return the result
              res.json(result);
              next();
            }).catch(function(err) {
              // Log
              Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
            break;

          // Create User
          case "UserCreate":
            // Check auth
            if (!CentralRestServerAuthorization.canCreateUser(req.user)) {
              // Not Authorized!
              Logging.logActionUnauthorizedMessageAndSendResponse(
                CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_CREATE, req, res, next);
              return;
            }
            // Check Mandatory fields
            if (Users.checkIfUserValid(req, res, next)) {
              // Check email
              global.storage.getUserByEmail(req.body.email).then(function(user) {
                if (user) {
                  Logging.logActionErrorMessageAndSendResponse(action, `The email ${req.body.tagIDs} already exists`, req, res, next);
                  return;
                }

                // Create user
                var newUser = new User(req.body);

                // Set the locale
                newUser.setLocale(req.locale);

                // Update timestamp
                newUser.setCreatedBy(`${req.user.name} ${req.user.firstName}`);
                newUser.setCreatedOn(new Date());

                // Save
                newUser.save().then(() => {
                  Logging.logInfo({
                    user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
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

          // Unknown Context
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

    // Get Request
    case "GET":
      // Check Action
      switch (action) {
        // Get the Logging
        case "Loggings":
          // Check auth
          if (!CentralRestServerAuthorization.canListLogging(req.user)) {
            // Not Authorized!
            Logging.logActionUnauthorizedMessageAndSendResponse(
              CentralRestServerAuthorization.ENTITY_LOGGING, CentralRestServerAuthorization.ACTION_LIST, req, res, next);
            return;
          }
          // Get logs
          Logging.getLogs(req.query.DateFrom, req.query.Search, req.query.NumberOfLogs).then((loggings) => {
            // Return
            res.json(loggings);
            next();
          });
          break;

        // Get all the charging stations
        case "ChargingStations":
          // Check auth
          if (!CentralRestServerAuthorization.canListChargingStations(req.user)) {
            // Not Authorized!
            Logging.logActionUnauthorizedMessageAndSendResponse(
              CentralRestServerAuthorization.ENTITY_CHARGING_STATIONS, CentralRestServerAuthorization.ACTION_LIST, req, res, next);
            return;
          }
          global.storage.getChargingStations(req.query.Search, 100).then((chargingStations) => {
            var chargingStationsJSon = [];
            chargingStations.forEach(function(chargingStation) {
              // Check auth
              if (CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Set the model
                chargingStationsJSon.push(chargingStation.getModel());
              }
            });
            // Return
            res.json(chargingStationsJSon);
            next();
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get one charging station
        case "ChargingStation":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          // Get it
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then((chargingStation) => {
            if (chargingStation) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
              res.json(chargingStation.getModel());
            } else {
              res.json({});
            }
            next();
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get all the users
        case "Users":
          // Check auth
          if (!CentralRestServerAuthorization.canListUsers(req.user)) {
            // Not Authorized!
            Logging.logActionUnauthorizedMessageAndSendResponse(
              CentralRestServerAuthorization.ENTITY_USERS, CentralRestServerAuthorization.ACTION_LIST, req, res, next);
            return;
          }
          global.storage.getUsers(req.query.Search, 100).then(function(users) {
            var usersJSon = [];
            users.forEach(function(user) {
              // Check auth
              if (CentralRestServerAuthorization.canReadUser(req.user, user.getModel())) {
                // Yes: add user
                // Clear image
                user.image = "";
                // Clear Sensitive Data
                user.setPassword("");
                // Must be admin to get the user/pass
                if (!CentralRestServerAuthorization.isAdmin(req.user)) {
                  // Clear role
                  user.setRole("");
                }
                // Set the model
                usersJSon.push(user.getModel());
              }
            });
            // Return
            res.json(usersJSon);
            next();
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the user
        case "UserByEmail":
          // User mandatory
          if(!req.query.Email) {
            Logging.logActionErrorMessageAndSendResponse(action, `The User's email is mandatory`, req, res, next);
            break;
          }
          // Get
          global.storage.getUserByEmail(req.query.Email).then(function(user) {
            if (user) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadUser(req.user, user.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
              // Clear Sensitive Data
              user.setPassword("");
              // Must be admin to get the user/pass
              if (!CentralRestServerAuthorization.isAdmin(req.user)) {
                // Clear role
                user.setRole("");
              }
              // Set
              res.json(user.getModel());
            } else {
              res.json({});
            }
            next();
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the user
        case "User":
          // User mandatory
          if(!req.query.ID) {
            Logging.logActionErrorMessageAndSendResponse(action, `The User's ID is mandatory`, req, res, next);
            break;
          }
          global.storage.getUser(req.query.ID).then(function(user) {
            if (user) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadUser(req.user, user.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
              // Clear Sensitive Data
              user.setPassword("");
              // Must be admin to get the user/pass
              if (!CentralRestServerAuthorization.isAdmin(req.user)) {
                // Clear role
                user.setRole("");
              }
              // Set the user
              res.json(user.getModel());
            } else {
              res.json({});
            }
            next();
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the user
        case "UserByTagId":
          // User mandatory
          if(!req.query.TagId) {
            Logging.logActionErrorMessageAndSendResponse(action, `The User's Tag ID is mandatory`, req, res, next);
            break;
          }
          // Set
          global.storage.getUserByTagId(req.query.TagId).then(function(user) {
            if (user) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadUser(req.user, user.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
              // Clear Sensitive Data
              user.setPassword("");
              // Must be admin to get the user/pass
              if (!CentralRestServerAuthorization.isAdmin(req.user)) {
                // Clear role
                user.setRole("");
              }
              // Set data
              res.json(user.getModel());
            } else {
              res.json({});
            }
            next();
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the transactions
        case "ChargingStationTransactions":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          // Connector Id is mandatory
          if(!req.query.ConnectorId) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Connector ID is mandatory`, req, res, next);
            break;
          }

          // Get Charge Box
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            if (chargingStation) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
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
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the transaction
        case "ChargingStationTransaction":
          // Charge Box is mandatory
          if(!req.query.TransactionId) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Transaction ID is mandatory`, req, res, next);
            break;
          }

          // Set the model
          global.storage.getTransaction(req.query.TransactionId).then((transaction) => {
            if (transaction) {
              // Return
              res.json(transaction);
              next();
            } else {
              // Log
              return Promise.reject(new Error(`Transaction ${req.query.TransactionId} does not exist`));
            }
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the last transaction
        case "ChargingStationLastTransaction":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          // Connector Id is mandatory
          if(!req.query.ConnectorId) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Connector ID is mandatory`, req, res, next);
            break;
          }

          // Get Charge Box
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            if (chargingStation) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
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
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get all the Status Notifications
        case "ChargingStationStatusNotifications":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          // Charging Station Provided?
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let statusNotifications = [];
            // Found
            if (chargingStation) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
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
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the last Status Notifications
        case "ChargingStationLastStatusNotification":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          if(!req.query.ConnectorId) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Connector ID is mandatory`, req, res, next);
            break;
          }
          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let statusNotifications = {};
            // Found?
            if (chargingStation) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
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
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get Charging Consumption
        case "ChargingStationConsumptionFromDateTimeRange":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let consumptions = [];

            // Found
            if (chargingStation) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
              // Get the Consumption
              chargingStation.getConsumptionsFromDateTimeRange(
                  req.query.ConnectorId,
                  req.query.StartDateTime,
                  req.query.EndDateTime,
                  false).then(function(consumptions) {
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
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get Charging Consumption
        case "ChargingStationConsumptionFromTransaction":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
            break;
          }
          // Connector Id is mandatory
          if(!req.query.ConnectorId) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Connector ID is mandatory`, req, res, next);
            break;
          }
          // Transaction Id is mandatory
          if(!req.query.TransactionId) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Transaction ID is mandatory`, req, res, next);
            break;
          }

          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let consumptions = [];

            // Found
            if (chargingStation) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
              // Get the Consumption
              chargingStation.getConsumptionsFromTransaction(
                  req.query.ConnectorId,
                  req.query.TransactionId,
                  true).then(function(consumptions) {

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
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get Charging Configuration
        case "ChargingStationConfiguration":
          // Charge Box is mandatory
          if(!req.query.ChargeBoxIdentity) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Charging Station ID is mandatory`, req, res, next);
            break;
          }

          // Get the Charging Station`
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then(function(chargingStation) {
            let configuration = {};
            // Found
            if (chargingStation) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, req, res, next);
                return;
              }
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
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Unknown Action
        default:
          // Action provided
          if (!action) {
            // Log
            Logging.logActionErrorMessageAndSendResponse("N/A", `No Action has been provided`, req, res, next);
          } else {
            // Log
            Logging.logActionErrorMessageAndSendResponse("N/A", `The Action '${action}' does not exist`, req, res, next);
          }
      }
      break;

    // Update Request
    case "PUT":
      // Check
      switch (action) {
        // User
        case "UserUpdate":
          // Check Mandatory fields
          if (Users.checkIfUserValid(req, res, next)) {
            // Check email
            global.storage.getUser(req.body.id).then(function(user) {
              if (!user) {
                Logging.logActionErrorMessageAndSendResponse(action, `The user with ID ${req.body.id} does not exist anymore`, req, res, next);
                return;
              }

              // Check auth
              if (!CentralRestServerAuthorization.canUpdateUser(req.user, user.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_UPDATE, req, res, next);
                return;
              }

              // Check if Role is provided
              if (req.body.role && req.body.role !== req.user.role && req.user.role !== "A") {
                // Role provided and not an Admin
                Logging.logError({
                  user: req.user, source: "Central Server", module: "CentralServerRestService", method: "UpdateUser",
                  message: `User ${req.user.firstName} ${req.user.name} tries to update his role to '${req.body.role}' without having the Admin priviledge (current role: '${req.user.role}')` });
                // Ovverride it
                req.body.role = req.user.role;
              }

              // Update
              Database.updateUser(req.body, user.getModel());

              // Set the locale
              user.setLocale(req.locale);

              // Update timestamp
              user.setLastChangedBy(`${req.user.name} ${req.user.firstName}`);
              user.setLastChangedOn(new Date());

              // Check the password
              if (req.body.passwords.password && req.body.passwords.password.length > 0) {
                // Hash the pass
                let passwordHashed = Users.hashPassword(req.body.passwords.password);
                // Update the password
                user.setPassword(passwordHashed);
              }
              // Update
              user.save().then(() => {
                Logging.logInfo({
                  user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
                  message: `User ${user.getFullName()} with Email ${user.getEMail()} has been updated successfully`,
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

          // Not found
        default:
          // Action provided
          if (!action) {
            // Log
            Logging.logActionErrorMessageAndSendResponse(action, `No Action has been provided`, req, res, next);
          } else {
            // Log
            Logging.logActionErrorMessageAndSendResponse(action, `The Action '${action}' does not exist`, req, res, next);
          }
          break;
      }
      break;

      // Delete Request
      case "DELETE":
        // Check
        switch (action) {
          // User
          case "UserDelete":
            // Check Mandatory fields
            if(!req.query.ID) {
              Logging.logActionErrorMessageAndSendResponse(action, `The user's ID must be provided`, req, res, next);
              return;
            }
            // Check email
            global.storage.getUser(req.query.ID).then((user) => {
              if (!user) {
                Logging.logActionErrorMessageAndSendResponse(action, `The user with ID ${req.body.id} does not exist anymore`, req, res, next);
                return;
              }
              // Check auth
              if (!CentralRestServerAuthorization.canDeleteUser(req.user, user.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_DELETE, req, res, next);
                return;
              }
              // Delete
              global.storage.deleteUser(req.query.ID).then(() => {
                // Log
                Logging.logInfo({
                  user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
                  message: `User ${user.getFullName()} with Email ${user.getEMail()} has been deleted successfully`,
                  detailedMessages: user});
                // Ok
                res.json({status: `Success`});
                next();
              });
            }).catch((err) => {
              // Log
              Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
            break;

          // Charging station
          case "ChargingStationDelete":
            // Check Mandatory fields
            if(!req.query.ID) {
              Logging.logActionErrorMessageAndSendResponse(action, `The charging station's ID must be provided`, req, res, next);
              return;
            }
            // Check email
            global.storage.getChargingStation(req.query.ID).then((chargingStation) => {
              if (!chargingStation) {
                Logging.logActionErrorMessageAndSendResponse(action, `The charging station with ID ${req.body.id} does not exist anymore`, req, res, next);
                return;
              }
              // Check auth
              if (!CentralRestServerAuthorization.canDeleteChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_DELETE, req, res, next);
                return;
              }
              // Delete
              global.storage.deleteChargingStation(req.query.ID).then(() => {
                // Log
                Logging.logInfo({
                  user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
                  message: `Charging Station ${chargingStation.getChargeBoxIdentity()} has been deleted successfully`,
                  detailedMessages: user});
                // Ok
                res.json({status: `Success`});
                next();
              });
            }).catch((err) => {
              // Log
              Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
            });
            break;

            // Not found
          default:
            // Action provided
            if (!action) {
              // Log
              Logging.logActionErrorMessageAndSendResponse("N/A", `No Action has been provided`, req, res, next);
            } else {
              // Log
              Logging.logActionErrorMessageAndSendResponse("N/A", `The Action '${action}' does not exist`, req, res, next);
            }
            break;
        }
        break;

    default:
      // Log
      Logging.logActionErrorMessageAndSendResponse("N/A", `Ussuported request method ${req.method}`, req, res, next);
      break;
    }
  }
};
