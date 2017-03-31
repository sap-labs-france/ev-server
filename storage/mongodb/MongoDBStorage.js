var mongoose = require('mongoose');
var Promise = require('promise');
var MDBConfiguration = require('./model/MDBConfiguration');
var MDBUser = require('./model/MDBUser');
var MDBFirmwareStatusNotification = require('./model/MDBFirmwareStatusNotification');
var MDBDiagnosticsStatusNotification = require('./model/MDBDiagnosticsStatusNotification');
var MDBChargingStation = require('./model/MDBChargingStation');
var MDBAuthorize = require('./model/MDBAuthorize');
var MDBBootNotification = require('./model/MDBBootNotification');
var MDBStatusNotification = require('./model/MDBStatusNotification');
var MDBMeterValue = require('./model/MDBMeterValue');
var MDBStartTransaction = require('./model/MDBStartTransaction');
var MDBStopTransaction = require('./model/MDBStopTransaction');
var MDBDataTransfer = require('./model/MDBDataTransfer');
var User = require('../../model/User');
var ChargingStation = require('../../model/ChargingStation');
var Utils = require('../../utils/Utils');
var Storage = require('../Storage');

class MongoDBStorage extends Storage {
    constructor(dbConfig) {
        super(dbConfig);

        // Keep local
        // TODO: Check params
        this.dbConfig = dbConfig;

        // Ovverride deprecated promise
        mongoose.Promise = Promise;

        // Connect
        mongoose.connect(`mongodb://${dbConfig.host}:${dbConfig.port}/${dbConfig.schema}`, function(err, db) {
            if (err) {
                console.log(`MongoDB: Error when connecting: ${err.message}`);
                return;
            }
            console.log(`MongoDB: Connected to ${dbConfig.host}:${dbConfig.port}, Schema ${dbConfig.schema}`);
        });
    }

    getConfigurationParamValue(chargeBoxIdentity, paramName, configDate) {
      // Get the config
      return this.getConfiguration(chargeBoxIdentity, configDate).then(function(configuration) {
        var value = null;

        if (configuration) {
          // Get the value
          configuration.configuration.every(function(param) {
            // Check
            if (param.key === paramName) {
              // Found!
              value = param.value;
              // Break
              return false;
            } else {
              // Continue
              return true;
            }
          });
          // Send the value
          return value;
        } else {
          // No config
          return value;
        }
      });
    }

    getConfiguration(chargeBoxIdentity, configDate) {
      if (!configDate) {
        configDate = new Date();
      }
      // Get the Config
      return new Promise(function(fulfill, reject) {
          // Exec request
          MDBConfiguration.find({"chargeBoxIdentity": chargeBoxIdentity, timestamp: { $lte: configDate } })
            .limit(1).sort({timestamp: -1}).exec(function(err, configurationMongoDB) {
              var configuration = {};

              if (err) {
                  reject(err);
              } else {
                  if (configurationMongoDB[0]) {
                    // Set values
                    Utils.updateConfiguration(configurationMongoDB[0], configuration);
                  }
                  // Ok
                  fulfill(configuration);
              }
          });
      });
    }

    getStatusNotifications(chargeBoxIdentity, connectorId) {
      // Get the Status Notification
      return new Promise(function(fulfill, reject) {
        var filter = {};
        if (chargeBoxIdentity) {
          filter.chargeBoxIdentity = chargeBoxIdentity;
        }
        if (connectorId) {
          filter.connectorId = connectorId;
        }
        // Exec request
        MDBStatusNotification.find(filter)
          .sort({timestamp: 1}).exec(function(err, statusNotificationsMongoDB) {
            var statusNotifications = [];

            if (err) {
                reject(err);
            } else {
                // Create
                statusNotificationsMongoDB.forEach(function(statusNotificationMongoDB) {
                  var statusNotification = {};
                  // Set values
                  Utils.updateStatusNotification(statusNotificationMongoDB, statusNotification);
                  // Add
                  statusNotifications.push(statusNotification);
                });
                // Ok
                fulfill(statusNotifications);
            }
        });
      });
    }

    getLastStatusNotification(chargeBoxIdentity, connectorId) {
      // Get the Status Notification
      return new Promise(function(fulfill, reject) {
        var filter = {};
        var statusNotification = {};

        // Must be provided
        if(chargeBoxIdentity && connectorId) {
          filter.chargeBoxIdentity = chargeBoxIdentity;
          filter.connectorId = connectorId;

          // Exec request
          MDBStatusNotification.find(filter)
            .sort({timestamp: -1}).limit(1).exec(function(err, statusNotificationsMongoDB) {
              if (err) {
                  reject(err);
              } else {
                  // At least one
                  if (statusNotificationsMongoDB[0]) {
                    // Set values
                    Utils.updateStatusNotification(statusNotificationsMongoDB[0], statusNotification);
                  }
                  // Ok
                  fulfill(statusNotification);
              }
          });
        } else {
          // Ok
          fulfill(statusNotification);
        }
      });
    }

    getMeterValues(chargeBoxIdentity, connectorId, transactionId, startDateTime, endDateTime) {
      // Get the Status Notification
      return new Promise(function(fulfill, reject) {
          // Build filter
          var filter = {};
          // Mandatory filters
          filter.chargeBoxIdentity = chargeBoxIdentity;
          filter.connectorId = connectorId;

          if (transactionId) {
            filter.transactionId = transactionId;
          }
          if (startDateTime || endDateTime) {
            filter.timestamp = {};
          }
          if (startDateTime) {
            filter.timestamp["$gte"] = new Date(startDateTime);
          }
          if (endDateTime) {
            filter.timestamp["$lte"] = new Date(endDateTime);
          }

          // Exec request
          MDBMeterValue.find(filter).sort( {timestamp: 1} ).exec(function(err, meterValuesMongoDB) {
            var meterValues = [];

            if (err) {
              reject(err);
            } else {
              // Create
              meterValuesMongoDB.forEach(function(meterValueMongoDB) {
                var meterValue = {};
                // Set values
                Utils.updateMeterValue(meterValueMongoDB, meterValue);
                // Add
                meterValues.push(meterValue);
              });
              // Ok
              fulfill(meterValues);
            }
          });
      });
    }

    saveBootNotification(bootNotification) {
      // Get
      return this._getChargingStationMongoDB(bootNotification.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        // Create model
        var bootNotificationMongoDB = new MDBBootNotification(bootNotification);

        if (chargingStationMongoDB) {
          // Set the ID
          bootNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
        }

        // Create new
        return bootNotificationMongoDB.save(function(err, results) {
            if (err) {
                console.log(`MongoDB: Error when creating Boot Notication of ${bootNotification.chargeBoxIdentity}: ${err.message}`);
            } else {
              console.log(`MongoDB: Boot Notication of ${bootNotification.chargeBoxIdentity} created with success`);
            }
        });
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    saveDataTransfer(dataTransfer) {
      // Get
      return this._getChargingStationMongoDB(dataTransfer.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        if (chargingStationMongoDB) {
          // Create model
          var dataTransferMongoDB = new MDBDataTransfer(dataTransfer);

          // Set the ID
          dataTransferMongoDB.chargeBoxID = chargingStationMongoDB._id;

          // Create new
          return dataTransferMongoDB.save(function(err, results) {
              if (err) {
                  console.log(`MongoDB: Error when creating Data Transfer of ${dataTransfer.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Data Transfer of ${dataTransfer.chargeBoxIdentity} created with success`);
              }
          });
        } else {
          console.log(`MongoDB: Charging Station ${dataTransfer.chargeBoxIdentity} not found: Cannot add Data Transfer`);
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    saveConfiguration(configuration) {
      // Get
      return this._getChargingStationMongoDB(configuration.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        if (chargingStationMongoDB) {
          // Create model
          var configurationMongoDB = new MDBConfiguration(configuration);

          // Set the ID
          configurationMongoDB.chargeBoxID = chargingStationMongoDB._id;
          configurationMongoDB.configuration = configuration.configurationKey;

          // Create new
          return configurationMongoDB.save(function(err, results) {
              if (err) {
                  console.log(`MongoDB: Error when creating the Configuration of ${configurationMongoDB.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Configuration of ${configurationMongoDB.chargeBoxIdentity} created with success`);
              }
          });
        } else {
          console.log(`MongoDB: Charging Station ${configurationMongoDB.chargeBoxIdentity} not found: Cannot save Configuration`);
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    saveStatusNotification(statusNotification) {
      // Get
      return this._getChargingStationMongoDB(statusNotification.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        if (chargingStationMongoDB) {
          // Save
          chargingStationMongoDB.save(function(err, results) {
            if (err) {
              console.log(`MongoDB: Error when saving the Status of ${statusNotification.chargeBoxIdentity}: ${err.message}`);
            }
          });

          // Create model
          var statusNotificationMongoDB = new MDBStatusNotification(statusNotification);

          // Set the ID
          statusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

          // Create new
          return statusNotificationMongoDB.save(function(err, results) {
              if (err) {
                console.log(`MongoDB: Error when creating Status Notification of ${statusNotification.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Status Notification of ${statusNotification.chargeBoxIdentity} created with success`);
              }
          });
        } else {
          console.log(`MongoDB: Charging Station ${statusNotification.chargeBoxIdentity} not found: Cannot add Status Notification`);
        }
      });
    }

    saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
      // Get
      return this._getChargingStationMongoDB(diagnosticsStatusNotification.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        if (chargingStationMongoDB) {
          // Create model
          var diagnosticsStatusNotificationMongoDB = new MDBDiagnosticsStatusNotification(diagnosticsStatusNotification);

          // Set the ID
          diagnosticsStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

          // Create new
          return diagnosticsStatusNotificationMongoDB.save(function(err, results) {
              if (err) {
                console.log(`MongoDB: Error when creating an Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity} created with success`);
              }
          });
        } else {
          console.log(`MongoDB: Charging Station ${diagnosticsStatusNotification.chargeBoxIdentity} not found: Cannot create Diagnostics Status Notification request`);
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    saveFirmwareStatusNotification(firmwareStatusNotification) {
      // Get
      return this._getChargingStationMongoDB(firmwareStatusNotification.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        if (chargingStationMongoDB) {
          // Create model
          var firmwareStatusNotificationMongoDB = new MDBFirmwareStatusNotification(firmwareStatusNotification);

          // Set the ID
          firmwareStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

          // Create new
          return firmwareStatusNotificationMongoDB.save(function(err, results) {
              if (err) {
                console.log(`MongoDB: Error when creating an Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity} created with success`);
              }
          });
        } else {
          console.log(`MongoDB: Charging Station ${firmwareStatusNotification.chargeBoxIdentity} not found: Cannot create Firmware Status Notification request`);
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    saveAuthorize(authorize) {
      // Get
      return this._getChargingStationMongoDB(authorize.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        if (chargingStationMongoDB) {
          // Create model
          var authorizeMongoDB = new MDBAuthorize(authorize);

          // Set the ID
          authorizeMongoDB.chargeBoxID = chargingStationMongoDB._id;

          // Create new
          return authorizeMongoDB.save(function(err, results) {
              if (err) {
                console.log(`MongoDB: Error when creating an Authorize request of ${authorize.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Authorize request of ${authorize.chargeBoxIdentity} created with success`);
              }
          });
        } else {
          console.log(`MongoDB: Charging Station ${authorize.chargeBoxIdentity} not found: Cannot create Authorize request`);
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    saveStartTransaction(startTransaction) {
      // Get
      return this._getChargingStationMongoDB(startTransaction.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        if (chargingStationMongoDB) {
          // Create model
          var startTransactionMongoDB = new MDBStartTransaction(startTransaction);

          // Set the ID
          startTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;

          // Create new
          return startTransactionMongoDB.save(function(err, results) {
              if (err) {
                console.log(`MongoDB: Error when creating Start Transaction of ${startTransaction.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Start Transaction of ${startTransaction.chargeBoxIdentity} created with success`);
              }
          });
        } else {
          console.log(`MongoDB: Charging Station ${startTransaction.chargeBoxIdentity} not found: Cannot create Start Transaction`);
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    saveStopTransaction(stopTransaction) {
      // Get
      return this._getChargingStationMongoDB(stopTransaction.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        if (chargingStationMongoDB) {
          // Create model
          var stopTransactionMongoDB = new MDBStopTransaction(stopTransaction);

          // Set the ID
          stopTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;

          // Create new
          return stopTransactionMongoDB.save(function(err, results) {
              if (err) {
                console.log(`MongoDB: Error when creating Stop Transaction of ${stopTransaction.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Stop Transaction of ${stopTransaction.chargeBoxIdentity} created with success`);
              }
          });
        } else {
          console.log(`MongoDB: Charging Station ${stopTransaction.chargeBoxIdentity} not found: Cannot create Stop Transaction`);
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    saveMeterValues(meterValues) {
      // Get
      return this._getChargingStationMongoDB(meterValues.chargeBoxIdentity).then(function(chargingStationMongoDB) {
        if (chargingStationMongoDB) {
          // For each value
          meterValues.values.forEach(function(meterValue) {
            // Create model
            var meterValueMongoDB = new MDBMeterValue(meterValue);

            // Set the ID
            meterValueMongoDB.chargeBoxID = chargingStationMongoDB._id;

            // Create new
            meterValueMongoDB.save(function(err, results) {
                if (err) {
                  console.log(`MongoDB: Error when saving Meter Value of ${meterValues.chargeBoxIdentity}: ${err.message}`);
                } else {
                  console.log(`MongoDB: Meter Value of ${meterValues.chargeBoxIdentity} created with success`);
                }
            });
          });

          return new Promise();

        } else {
          console.log(`MongoDB: Charging Station ${meterValues.chargeBoxIdentity} not found: Cannot add Meter Value`);
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    saveChargingStation(chargingStation) {
      // Get
      return this._getChargingStationMongoDB(chargingStation.getChargeBoxIdentity()).then(function(chargingStationMongoDB) {
        // Found?
        if (!chargingStationMongoDB) {
            // No: Create it
            var newChargingStationMongoDB = new MDBChargingStation(chargingStation.getModel());

            // Create new
            newChargingStationMongoDB.save(function(err, results) {
                if (err) {
                    console.log(`MongoDB: Error when creating Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
                } else {
                  console.log(`MongoDB: Charging Station ${chargingStation.getChargeBoxIdentity()} created with success`);
                }
            });
        } else {
            // Set data
            Utils.updateChargingStationObject(chargingStation.getModel(), chargingStationMongoDB);

            // No: Update it
            chargingStationMongoDB.save(function(err, results) {
                if (err) {
                    console.log(`MongoDB: Error when updating Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
                } else {
                    console.log(`MongoDB: Charging Station ${chargingStation.getChargeBoxIdentity()} updated with success`);
                }
            });
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
      });
    }

    getChargingStation(chargeBoxIdentity) {
        // Get
        return this._getChargingStationMongoDB(chargeBoxIdentity).then(function(chargingStationMongoDB) {
            var chargingStation = null;

            // Found
            if (chargingStationMongoDB != null) {
                // Create
                chargingStation = new ChargingStation(chargingStationMongoDB);
            }

            return chargingStation;
        }).catch(function(err) {
          console.log(`MongoDB: Error in reading the Charging Station ${chargeBoxIdentity}: ${err.message}`);
        });
    }

    getChargingStations() {
      // Get the Charging Station
      return new Promise(function(fulfill, reject) {
          // Exec request
          MDBChargingStation.find({}).sort( {chargeBoxIdentity: 1} ).exec(function(err, chargingStationsMongoDB) {
              var chargingStations = [];

              if (err) {
                  reject(err);
              } else {
                  // Create
                  chargingStationsMongoDB.forEach(function(chargingStationMongoDB) {
                    chargingStations.push(new ChargingStation(chargingStationMongoDB));
                  });
                  // Ok
                  fulfill(chargingStations);
              }
          });
      });
    }

    _getChargingStationMongoDB(chargeBoxIdentity) {
      // Get the Charging Station
      return new Promise(function(fulfill, reject) {
          // Exec request
          MDBChargingStation.find({"chargeBoxIdentity": chargeBoxIdentity},
            function(err, chargingStationsMongoDB) {
              var chargingStationMongoDB = null;
              if (err) {
                  reject(err);
              } else {
                  // Check
                  if (chargingStationsMongoDB.length > 0) {
                      chargingStationMongoDB = chargingStationsMongoDB[0];
                  } else {
                    console.log(`MongoDB: Charging Station ${chargeBoxIdentity} does not exist`);
                  }
                  // Ok
                  fulfill(chargingStationMongoDB);
              }
          });
      });
    }

    getUsers() {
      // Get the Charging Station
      return new Promise(function(fulfill, reject) {
          // Exec request
          MDBUser.find({}).sort( {name: 1} ).exec(function(err, usersMongoDB) {
              var users = [];

              if (err) {
                  reject(err);
              } else {
                  // Create
                  usersMongoDB.forEach(function(userMongoDB) {
                    users.push(new User(userMongoDB));
                  });
                  // Ok
                  fulfill(users);
              }
          });
      });
    }

    saveUser(user) {
      // Get
      return this._getUserByTagIdMongoDB(user.getTagID()).then(function(userMongoDB) {
        // Found?
        if (!userMongoDB) {
            // No: Create it
            var newUserMongoDB = new MDBUser(user.getModel());

            // Create new
            newUserMongoDB.save(function(err, results) {
                if (err) {
                    console.log(`MongoDB: Error when creating User  ${user.getName()}: ${err.message}`);
                } else {
                  console.log(`MongoDB: User ${user.getName()} created with success`);
                }
            });
        } else {
            // Set data
            Utils.updateUser(user.getModel(), userMongoDB);

            // No: Update it
            userMongoDB.save(function(err, results) {
                if (err) {
                    console.log(`MongoDB: Error when updating User ${user.getName()}: ${err.message}`);
                } else {
                  console.log(`MongoDB: User ${user.getName()} updated with success`);
                }
            });
        }
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the User ${user.getName()}: ${err.message}`);
      });
    }

    getTransactions(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
      var that = this;

      // Get the Charging Station
      return new Promise(function(fulfill, reject) {
          // Build filter
          var filter = {};
          if (chargeBoxIdentity) {
            filter.chargeBoxIdentity = chargeBoxIdentity;
          }
          if (connectorId) {
            filter.connectorId = connectorId;
          }
          if (startDateTime || endDateTime) {
            filter.timestamp = {};
          }
          if (startDateTime) {
            filter.timestamp["$gte"] = new Date(startDateTime);
          }
          if (endDateTime) {
            filter.timestamp["$lte"] = new Date(endDateTime);
          }

          // Get the Start Transaction
          MDBStartTransaction.find(filter).sort( {timestamp: -1} ).exec(function(err, transactionsMongoDB) {
              var transactions = [];

              if (err) {
                  reject(err);
              } else {
                  // Create
                  transactionsMongoDB.forEach(function(transactionMongoDB) {
                    var transaction = {};
                    // Set
                    Utils.updateStartTransaction(transactionMongoDB, transaction);
                    // Add
                    transactions.push(transaction);
                  });
                  // Ok
                  return transactions;
              }
          // Get the Users
          }).then(function(transactions) {
            var userPromises = [];

            // Get the user for each transaction
            for (var i = 0; i < transactions.length; i++) {
              // Call in a function to pass the index in the Promise
              (function(transaction) {
                // Get the user
                userPromises.push(
                  // Get the user
                  that.getUserByTagId(transaction.idTag).then(function(user) {
                    // Set
                    if(user) {
                      // Set the User
                      transaction.user = user.getModel();
                    }
                    return transaction;
                  })
                );
              })(transactions[i]);
            }

            Promise.all(userPromises).then(function(transactions) {
              fullfill(transactions);
            });
          });
      });
    }

    getUserByTagId(tagID) {
      // Get
      return this._getUserByTagIdMongoDB(tagID).then(function(userMongoDB) {
          var user = null;

          // Found
          if (userMongoDB != null) {
            user = new User(userMongoDB);
          }

          return user;
      }).catch(function(err) {
        console.log(`MongoDB: Error in reading the User with Tag ID ${tagID}: ${err.message}`);
      });
    }

    _getUserByTagIdMongoDB(tagID) {
      // Get the Charging Station
      return new Promise(function(fulfill, reject) {
          // Exec request
          MDBUser.find({"tagID": tagID},
            function(err, usersMongoDB) {
              var userMongoDB = null;
              if (err) {
                  reject(err);
              } else {
                  // Check
                  if (usersMongoDB.length > 0) {
                      userMongoDB = usersMongoDB[0];
                  } else {
                    console.log(`MongoDB: User with Tag ID ${tagID} does not exist!`);
                  }
                  // Ok
                  fulfill(userMongoDB);
              }
          });
      });
    }
}

module.exports = MongoDBStorage;
