const Utils = require('../../utils/Utils');
const Database = require('../../utils/Database');
const Logging = require('../../utils/Logging');
const Users = require('../../utils/Users');
const User = require('../../model/User');
const moment = require('moment');
const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');
const SecurityRestObjectFiltering = require('./SecurityRestObjectFiltering');
const NotificationHandler = require('../../notification/NotificationHandler');

require('source-map-support').install();

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
        }
        break;
    }
  },

  restServiceSecured(req, res, next) {
    let filter;
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
                    CentralRestServerAuthorization.ENTITY_CHARGING_STATION, action, chargingStation.getChargeBoxIdentity(), req, res, next);
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
                          user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured", action: action,
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
                }).catch((err) => {
                  // Log error
                  Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
                });
              } else {
                // Charging station not found
                Logging.logActionErrorMessageAndSendResponse(action, `Charging Station with ID ${req.body.chargeBoxIdentity} does not exist`, req, res, next);
              }
            }).then((result) => {
              // Return the result
              res.json(result);
              next();
            }).catch((err) => {
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
                if (action === "StopTransaction" ||
                    action === "UnlockConnector") {
                  // Get Transaction
                  global.storage.getTransaction(req.body.args.transactionId).then((transaction) => {
                    if (transaction) {
                      // Add connector ID
                      req.body.args.connectorId = transaction.connectorId;
                      // Check auth
                      if (!CentralRestServerAuthorization.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), action, transaction.userID)) {
                        // Not Authorized!
                        Logging.logActionUnauthorizedMessageAndSendResponse(
                          CentralRestServerAuthorization.ENTITY_CHARGING_STATION, action, chargingStation.getChargeBoxIdentity(), req, res, next);
                        return;
                      }
                      // Log
                      Logging.logInfo({
                        user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",  action: action,
                        message: `Execute action '${action}' on Charging Station '${req.body.chargeBoxIdentity}'`});
                      // Execute it
                      return chargingStation.handleAction(action, req.body.args);
                    } else {
                      // Log
                      return Promise.reject(new Error(`Transaction ${req.query.TransactionId} does not exist`));
                    }
                  });
                } else {
                  // Check auth
                  if (!CentralRestServerAuthorization.canPerformActionOnChargingStation(req.user, chargingStation.getModel(), action)) {
                    // Not Authorized!
                    Logging.logActionUnauthorizedMessageAndSendResponse(
                      CentralRestServerAuthorization.ENTITY_CHARGING_STATION, action, chargingStation.getChargeBoxIdentity(), req, res, next);
                    return;
                  }
                  // Log
                  Logging.logInfo({
                    user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",  action: action,
                    message: `Execute action '${action}' on Charging Station '${req.body.chargeBoxIdentity}'`});
                  // Execute it
                  return chargingStation.handleAction(action, req.body.args);
                }
              } else {
                // Charging station not found
                Logging.logActionErrorMessageAndSendResponse(action, `Charging Station with ID ${req.body.chargeBoxIdentity} does not exist`, req, res, next);
              }
            }).then((result) => {
              // Return the result
              res.json(result);
              next();
            }).catch((err) => {
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
                CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_CREATE, null, req, res, next);
              return;
            }
            // Check Mandatory fields
            if (Users.checkIfUserValid(req, res, next)) {
              // Check email
              global.storage.getUserByEmail(req.body.email).then((user) => {
                if (user) {
                  Logging.logActionErrorMessageAndSendResponse(action, `The email ${req.body.tagIDs} already exists`, req, res, next, 510);
                  return;
                }
                // Create user
                var newUser = new User(req.body);
                // Set the locale
                newUser.setLocale(req.locale);
                // Update timestamp
                newUser.setCreatedBy(`${req.user.name} ${req.user.firstName}`);
                newUser.setCreatedOn(new Date());
                // Set the password
                newUser.setPassword(Users.hashPassword(req.body.passwords.password));
                // Save
                newUser.save().then(() => {
                  Logging.logInfo({
                    user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
                    message: `User ${newUser.getFullName()} with email ${newUser.getEMail()} has been created successfully`,
                    action: action, detailedMessages: user});

                    res.json({status: `Success`});
                    next();
                }).catch((err) => {
                  // Log error
                  Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
                });
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
              CentralRestServerAuthorization.ENTITY_LOGGING, CentralRestServerAuthorization.ACTION_LIST, null, req, res, next);
            return;
          }
          // Get logs
          Logging.getLogs(req.query.DateFrom, req.query.Level, req.query.ChargingStation,
              req.query.Search, req.query.NumberOfLogs, req.query.SortDate).then((loggings) => {
            // Return
            res.json(loggings);
            next();
          }).catch((err) => {
            // Log error
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get all the charging stations
        case "ChargingStations":
          // Check auth
          if (!CentralRestServerAuthorization.canListChargingStations(req.user)) {
            // Not Authorized!
            Logging.logActionUnauthorizedMessageAndSendResponse(
              CentralRestServerAuthorization.ENTITY_CHARGING_STATIONS, CentralRestServerAuthorization.ACTION_LIST, null, req, res, next);
            next();
            return;
          }
          // Get the charging stations
          global.storage.getChargingStations(req.query.Search, 100).then((chargingStations) => {
            // Get logged user
            global.storage.getUser(req.user.id).then((user) => {
              // Check
              if (user) {
                // Get the user's active transactions
                user.getTransactions({stop: {$exists: false}}).then(activeTransactions => {
                  // Handle
                  var chargingStationsJSon = [];
                  chargingStations.forEach((chargingStation) => {
                    // Check
                    let connectors = chargingStation.getConnectors();
                    // Set charging station active?
                    activeTransactions.forEach(activeTransaction => {
                      // Find a match
                      if (chargingStation.getChargeBoxIdentity() === activeTransaction.chargeBoxID.chargeBoxIdentity ) {
                        // Set
                        connectors[activeTransaction.connectorId.valueOf()-1].activeForUser = true;
                      }
                    });
                    // Check the connector?
                    if (req.query.OnlyActive === "true") {
                      // Remove the connector
                      for (let j = connectors.length-1; j >= 0; j--) {
                        // Not active?
                        if (!connectors[j].activeForUser) {
                          // Remove
                          connectors.splice(j, 1);
                        }
                      }
                      // Stil some connectors?
                      if (connectors.length > 0) {
                        // Add
                        chargingStationsJSon.push(chargingStation.getModel());
                      }
                    } else {
                      // Add
                      chargingStationsJSon.push(chargingStation.getModel());
                    }
                  });
                  // Return
                  res.json(
                    // Filter
                    SecurityRestObjectFiltering.filterChargingStations(
                      chargingStationsJSon, req.user)
                  );
                  next();
                });
              } else {
                Logging.logActionErrorMessageAndSendResponse(action, `The user with ID ${req.body.id} does not exist`, req, res, next);
              }
            });
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
            return;
          }
          // Get it
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then((chargingStation) => {
            if (chargingStation) {
              // Return
              res.json(
                // Filter
                SecurityRestObjectFiltering.filterChargingStation(
                  chargingStation.getModel(), req.user)
              );
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
              CentralRestServerAuthorization.ENTITY_USERS, CentralRestServerAuthorization.ACTION_LIST, null, req, res, next);
            return;
          }
          // Check param
          if(req.query.WithPicture) {
            req.query.WithPicture = (req.query.WithPicture === "true");
          } else {
            req.query.WithPicture = false;
          }
          // Get users
          global.storage.getUsers(req.query.Search, 100).then((users) => {
            var usersJSon = [];
            users.forEach((user) => {
              // Set the model
              usersJSon.push(user.getModel());
            });
            // Return
            res.json(
              // Filter
              SecurityRestObjectFiltering.filterUsers(
                usersJSon, req.user, req.query.WithPicture)
            );
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
            return;
          }
          // Get the user
          global.storage.getUser(req.query.ID).then((user) => {
            if (user) {
              // Set the user
              res.json(
                // Filter
                SecurityRestObjectFiltering.filterUser(
                  user.getModel(), req.user, true)
              );
            } else {
              res.json({});
            }
            next();
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the completed transactions
        case "CompletedTransactions":
          filter = {stop: {$exists: true}};
          // Check param
          if(req.query.WithPicture) {
            req.query.WithPicture = (req.query.WithPicture === "true");
          } else {
            req.query.WithPicture = false;
          }
          // Date
          if (req.query.StartDateTime) {
            filter.startDateTime = req.query.StartDateTime;
          }
          if (req.query.EndDateTime) {
            filter.endDateTime = req.query.EndDateTime;
          }
          // Check email
          global.storage.getTransactions(req.query.Search, filter).then((transactions) => {
            // Return
            res.json(
              // Filter
              SecurityRestObjectFiltering.filterTransactions(
                transactions, req.user, req.query.WithPicture)
            );
            next();
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

        // Get the consumption statistics
        case "ConsumptionStatistics":
          filter = {stop: {$exists: true}};
          // Date
          if (req.query.Year) {
            filter.startDateTime = moment().year(req.query.Year).startOf('year').toDate().toISOString();
            filter.endDateTime = moment().year(req.query.Year).endOf('year').toDate().toISOString();
          } else {
            filter.startDateTime = moment().startOf('year').toDate().toISOString();
            filter.endDateTime = moment().endOf('year').toDate().toISOString();
          }
          // Check email
          global.storage.getTransactions(null, filter).then((transactions) => {
            // filters
            transactions = transactions.filter((transaction) => {
              return CentralRestServerAuthorization.canReadUser(req.user, transaction.userID) &&
                CentralRestServerAuthorization.canReadChargingStation(req.user, transaction.chargeBoxID);
            });
            // Clean images
            transactions.forEach((transaction) => {
              if (transaction.userID && req.query.WithPicture === "false") {
                transaction.userID.image = null;
              }
              if (transaction.stop && transaction.stop.userID && req.query.WithPicture === "false") {
                transaction.stop.userID.image = null;
              }
            });
            // Group Them By Month
            let monthStats = [];
            let monthStat;
            // Browse in reverse order
            for (var i = transactions.length-1; i >= 0; i--) {
              // First Init
              if (!monthStat) {
                monthStat = {};
                monthStat.month = moment(transactions[i].timestamp).month();
              }
              // Month changed?
              if (monthStat.month != moment(transactions[i].timestamp).month()) {
                // Add
                monthStats.push(monthStat);
                // Reset
                monthStat = {};
                monthStat.month = moment(transactions[i].timestamp).month();
              }
              // Set consumption
              if (!monthStat[transactions[i].chargeBoxID.chargeBoxIdentity]) {
                // Add conso in kW.h
                monthStat[transactions[i].chargeBoxID.chargeBoxIdentity] = transactions[i].stop.totalConsumption / 1000;
              } else {
                // Add conso in kW.h
                monthStat[transactions[i].chargeBoxID.chargeBoxIdentity] += transactions[i].stop.totalConsumption / 1000;
              }
            }
            // Return
            res.json(monthStats);
            next();
          }).catch((err) => {
            // Log
            Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
          });
          break;

      // Get the consumption statistics
      case "UsageStatistics":
        filter = {stop: {$exists: true}};
        // Date
        if (req.query.Year) {
          filter.startDateTime = moment().year(req.query.Year).startOf('year').toDate().toISOString();
          filter.endDateTime = moment().year(req.query.Year).endOf('year').toDate().toISOString();
        } else {
          filter.startDateTime = moment().startOf('year').toDate().toISOString();
          filter.endDateTime = moment().endOf('year').toDate().toISOString();
        }
        // Check email
        global.storage.getTransactions(null, filter).then((transactions) => {
          // filters
          transactions = transactions.filter((transaction) => {
            return CentralRestServerAuthorization.canReadUser(req.user, transaction.userID) &&
              CentralRestServerAuthorization.canReadChargingStation(req.user, transaction.chargeBoxID);
          });
          // Clean images
          transactions.forEach((transaction) => {
            if (transaction.userID && req.query.WithPicture === "false") {
              transaction.userID.image = null;
            }
            if (transaction.stop && transaction.stop.userID && req.query.WithPicture === "false") {
              transaction.stop.userID.image = null;
            }
          });
          // Group Them By Month
          let monthStats = [];
          let monthStat;
          // Browse in reverse order
          for (var i = transactions.length-1; i >= 0; i--) {
            // First Init
            if (!monthStat) {
              monthStat = {};
              monthStat.month = moment(transactions[i].timestamp).month();
            }
            // Month changed?
            if (monthStat.month != moment(transactions[i].timestamp).month()) {
              // Add
              monthStats.push(monthStat);
              // Reset
              monthStat = {};
              monthStat.month = moment(transactions[i].timestamp).month();
            }
            // Set Usage
            if (!monthStat[transactions[i].chargeBoxID.chargeBoxIdentity]) {
              // Add Usage in Hours
              monthStat[transactions[i].chargeBoxID.chargeBoxIdentity] =
                (new Date(transactions[i].stop.timestamp).getTime() - new Date(transactions[i].timestamp).getTime()) / (3600 * 1000);
            } else {
              // Add Usage in Hours
              monthStat[transactions[i].chargeBoxID.chargeBoxIdentity] +=
                (new Date(transactions[i].stop.timestamp).getTime() - new Date(transactions[i].timestamp).getTime()) / (3600 * 1000);
            }
          }
          // Return
          res.json(monthStats);
          next();
        }).catch((err) => {
          // Log
          Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
        });
        break;

        // Get the active transactions
        case "ActiveTransactions":
          // Check param
          if(req.query.WithPicture) {
            req.query.WithPicture = (req.query.WithPicture === "true");
          } else {
            req.query.WithPicture = false;
          }
          // Check email
          global.storage.getTransactions(null, {stop: {$exists: false}}).then((transactions) => {
            // Return
            res.json(
              // Filter
              SecurityRestObjectFiltering.filterTransactions(
                transactions, req.user, req.query.WithPicture, true)
            );
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
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then((chargingStation) => {
            if (chargingStation) {
              // Set the model
              chargingStation.getTransactions(req.query.ConnectorId,
                req.query.StartDateTime, req.query.EndDateTime).then((transactions) => {
                  // Return
                  res.json(
                    // Filter
                    SecurityRestObjectFiltering.filterTransactions(
                      transactions, req.user, false, true)
                  );
                  next();
                }).catch((err) => {
                  // Log error
                  Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
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
        case "Transaction":
          // Charge Box is mandatory
          if(!req.query.TransactionId) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Transaction ID is mandatory`, req, res, next);
            return;
          }
          // Get Transaction
          global.storage.getTransaction(req.query.TransactionId).then((transaction) => {
            if (transaction) {
              // Return
              res.json(
                // Filter
                SecurityRestObjectFiltering.filterTransaction(
                  transaction, req.user, true)
              );
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

        // Get Charging Consumption
        case "ChargingStationConsumptionFromTransaction":
          // Transaction Id is mandatory
          if(!req.query.TransactionId) {
            Logging.logActionErrorMessageAndSendResponse(action, `The Transaction ID is mandatory`, req, res, next);
            return;
          }
          // Get Transaction
          global.storage.getTransaction(req.query.TransactionId).then((transaction) => {
            if (transaction) {
              // Get the Charging Station
              global.storage.getChargingStation(transaction.chargeBoxID.chargeBoxIdentity).then((chargingStation) => {
                let consumptions = [];
                // Found
                if (chargingStation) {
                  // Check auth
                  if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                    // Not Authorized!
                    Logging.logActionUnauthorizedMessageAndSendResponse(
                      CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, chargingStation.getChargeBoxIdentity(), req, res, next);
                    return;
                  }

                  // Check dates
                  if (req.query.StartDateTime) {
                    // Check date is in the transaction
                    if (!moment(req.query.StartDateTime).isSame(moment(transaction.timestamp)) &&
                        moment(req.query.StartDateTime).isBefore(moment(transaction.timestamp))) {
                      Logging.logActionErrorMessageAndSendResponse(action, `The requested Start Date ${req.query.StartDateTime} is before the transaction ID ${req.query.TransactionId} Start Date ${transaction.timestamp}`, req, res, next);
                      return;
                    }
                    // Check date is in the transaction
                    if (transaction.stop &&
                        !moment(req.query.StartDateTime).isSame(moment(transaction.stop.timestamp)) &&
                        moment(req.query.StartDateTime).isAfter(moment(transaction.stop.timestamp))) {
                      Logging.logActionErrorMessageAndSendResponse(action, `The requested Start Date ${req.query.StartDateTime} is after the transaction ID ${req.query.TransactionId} Stop Date ${transaction.stop.timestamp}`, req, res, next);
                      return;
                    }
                  }
                  // Check auth
                  if (!CentralRestServerAuthorization.canReadUser(req.user, transaction.userID)) {
                    // Demo user?
                    if (!CentralRestServerAuthorization.isDemo(req.user)) {
                      // No: Not Authorized!
                      Logging.logActionUnauthorizedMessageAndSendResponse(
                        CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_READ, Utils.buildUserFullName(transaction.userID), req, res, next);
                      return;
                    } else {
                      // Clear the user
                      transaction.userID = {};
                      transaction.userID.name = "####";
                      transaction.userID.firstName = "####";
                    }
                  }
                  // Check auth
                  if (transaction.stop && transaction.stop.userID &&
                     !CentralRestServerAuthorization.canReadUser(req.user, transaction.stop.userID)) {
                   // Demo user?
                   if (!CentralRestServerAuthorization.isDemo(req.user)) {
                     // No: Not Authorized!
                     Logging.logActionUnauthorizedMessageAndSendResponse(
                       CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_READ, Utils.buildUserFullName(transaction.stop.userID), req, res, next);
                     return;
                   } else {
                      // Clear the user
                      transaction.stop.userID = {};
                      transaction.stop.userID.name = "####";
                      transaction.stop.userID.firstName = "####";
                    }
                  }
                  // Dates provided?
                  if(!req.query.StartDateTime && !req.query.EndDateTime) {
                    // No: Get the Consumption from the transaction
                    chargingStation.getConsumptionsFromTransaction(
                        transaction, true).then((consumptions) => {
                      // Return the result
                      res.json(consumptions);
                      next();
                    });
                  } else {
                    // Yes: Get the Consumption from dates within the trasaction
                    chargingStation.getConsumptionsFromDateTimeRange(
                        transaction, req.query.StartDateTime).then((consumptions) => {
                      // Return the result
                      res.json(consumptions);
                      next();
                    });
                  }
                } else {
                  // Log
                  return Promise.reject(new Error(`Charging Station ${transaction.ChargeBoxIdentity} does not exist`));
                }
              }).catch((err) => {
                // Log
                Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
              });
            } else {
              // Log
              return Promise.reject(new Error(`Transaction ${req.query.TransactionId} does not exist`));
            }
          }).catch((err) => {
            // Log error
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
          global.storage.getChargingStation(req.query.ChargeBoxIdentity).then((chargingStation) => {
            let configuration = {};
            // Found
            if (chargingStation) {
              // Check auth
              if (!CentralRestServerAuthorization.canReadChargingStation(req.user, chargingStation.getModel())) {
                // Not Authorized!
                Logging.logActionUnauthorizedMessageAndSendResponse(
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_READ, chargingStation.getChargeBoxIdentity(), req, res, next);
                return;
              }
              // Get the Config
              chargingStation.getConfiguration().then((configuration) => {
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
          let statusHasChanged=false;
          // Check Mandatory fields
          if (Users.checkIfUserValid(req, res, next)) {
            // Check email
            global.storage.getUser(req.body.id).then((user) => {
              if (!user) {
                Logging.logActionErrorMessageAndSendResponse(
                  action, `The user with ID ${req.body.id} does not exist anymore`, req, res, next, 550);
                return;
              }

              // Check email
              global.storage.getUserByEmail(req.body.email).then((userWithEmail) => {
                if (userWithEmail) {
                  Logging.logActionErrorMessageAndSendResponse(
                    action, `The email ${req.body.email} already exists`, req, res, next, 510);
                  return;
                }
                // Check auth
                if (!CentralRestServerAuthorization.canUpdateUser(req.user, user.getModel())) {
                  // Not Authorized!
                  Logging.logActionUnauthorizedMessageAndSendResponse(
                    CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_UPDATE, Utils.buildUserFullName(user.getModel()), req, res, next);
                  return;
                }
                // Check if Role is provided and has been changed
                if (req.body.role && req.body.role !== user.getRole() && req.user.role !== Users.USER_ROLE_ADMIN) {
                  // Role provided and not an Admin
                  Logging.logError({
                    user: req.user, source: "Central Server", module: "CentralServerRestService", method: "UpdateUser",
                    message: `User ${Utils.buildUserFullName(req.user)} with role '${req.user.role}' tried to change the role of the user ${Utils.buildUserFullName(user.getModel())} to '${req.body.role}' without having the Admin priviledge` });
                  // Override it
                  req.body.role = user.getRole();
                }
                // Check if Role is provided
                if (req.body.status && req.body.status !== user.getStatus()) {
                  // Right to change?
                  if (req.user.role !== Users.USER_ROLE_ADMIN) {
                    // Role provided and not an Admin
                    Logging.logError({
                      user: req.user, source: "Central Server", module: "CentralServerRestService", method: "UpdateUser",
                      message: `User ${Utils.buildUserFullName(req.user)} with role '${req.user.role}' tried to update the status of the user ${Utils.buildUserFullName(user.getModel())} to '${req.body.status}' without having the Admin priviledge` });
                    // Ovverride it
                    req.body.status = user.getStatus();
                  } else {
                    // Status changed
                    statusHasChanged = true;
                  }
                }
                // Update
                Database.updateUser(req.body, user.getModel());
                // Set the locale
                user.setLocale(req.locale);
                // Update timestamp
                user.setLastChangedBy(`${Utils.buildUserFullName(req.user)}`);
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
                  // Log
                  Logging.logInfo({
                    user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
                    message: `User ${user.getFullName()} with Email ${user.getEMail()} and ID '${req.user.id}' has been updated successfully`,
                    action: action, detailedMessages: user});
                  // Notify
                  if (statusHasChanged) {
                    // Send notification
                    NotificationHandler.sendUserAccountStatusChanged(
                      Utils.generateID(),
                      user.getModel(),
                      {
                        "user": user.getModel(),
                        "evseDashboardURL" : Utils.buildEvseURL()
                      },
                      req.locale);
                  }
                  // Ok
                  res.json({status: `Success`});
                  next();
                }).catch((err) => {
                  // Log error
                  Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
                });
              });
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
                  CentralRestServerAuthorization.ENTITY_USER, CentralRestServerAuthorization.ACTION_DELETE, Utils.buildUserFullName(user.getModel()), req, res, next);
                return;
              }
              // Delete
              user.delete().then(() => {
                // Log
                Logging.logInfo({
                  user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
                  message: `User ${user.getFullName()} with Email ${user.getEMail()} and ID '${user.getID()}' has been deleted successfully`,
                  action: action, detailedMessages: user});
                // Ok
                res.json({status: `Success`});
                next();
              }).catch((err) => {
                // Log error
                Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
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
                  CentralRestServerAuthorization.ENTITY_CHARGING_STATION, CentralRestServerAuthorization.ACTION_DELETE, chargingStation.getChargeBoxIdentity(), req, res, next);
                return;
              }
              // Delete
              global.storage.deleteChargingStation(req.query.ID).then(() => {
                // Log
                Logging.logInfo({
                  user: req.user, source: "Central Server", module: "CentralServerRestService", method: "restServiceSecured",
                  message: `Charging Station ${chargingStation.getChargeBoxIdentity()} has been deleted successfully`,
                  action: action, detailedMessages: chargingStation});
                // Ok
                res.json({status: `Success`});
                next();
              }).catch((err) => {
                // Log error
                Logging.logActionUnexpectedErrorMessageAndSendResponse(action, err, req, res, next);
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
