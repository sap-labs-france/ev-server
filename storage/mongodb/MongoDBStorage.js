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
      // Get one param
      return new Promise((fulfill, reject) => {
        // Get the config
        this.getConfiguration(chargeBoxIdentity, configDate).then((configuration) => {
          var value = null;

          if (configuration) {
            // Get the value
            configuration.configuration.every((param) => {
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
          }
          // No config
          fulfill(value);
        });
      });
    }

    getConfiguration(chargeBoxIdentity, configDate) {
      // Get the Config
      return new Promise((fulfill, reject) => {
          if (!configDate) {
            configDate = new Date();
          }
          // Exec request
          MDBConfiguration.find({"chargeBoxIdentity": chargeBoxIdentity, timestamp: { $lte: configDate } })
            .limit(1).sort({timestamp: -1})
            .exec((err, configurationMongoDB) => {
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
      return new Promise((fulfill, reject) => {
        var filter = {};
        if (chargeBoxIdentity) {
          filter.chargeBoxIdentity = chargeBoxIdentity;
        }
        if (connectorId) {
          filter.connectorId = connectorId;
        }
        // Exec request
        MDBStatusNotification.find(filter)
          .sort({timestamp: 1}).exec((err, statusNotificationsMongoDB) => {
            var statusNotifications = [];

            if (err) {
              reject(err);
            } else {
              // Create
              statusNotificationsMongoDB.forEach((statusNotificationMongoDB) => {
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
      return new Promise((fulfill, reject) => {
        var filter = {};
        var statusNotification = {};

        // Must be provided
        if(chargeBoxIdentity && connectorId) {
          filter.chargeBoxIdentity = chargeBoxIdentity;
          filter.connectorId = connectorId;

          // Exec request
          MDBStatusNotification.find(filter)
            .sort({timestamp: -1}).limit(1)
            .exec((err, statusNotificationsMongoDB) => {
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
      return new Promise((fulfill, reject) => {
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
        MDBMeterValue.find(filter).sort( {timestamp: 1} ).exec((err, meterValuesMongoDB) => {
          var meterValues = [];

          if (err) {
            reject(err);
          } else {
            // Create
            meterValuesMongoDB.forEach((meterValueMongoDB) => {
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
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(bootNotification.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Create model
          var bootNotificationMongoDB = new MDBBootNotification(bootNotification);

          if (chargingStationMongoDB) {
            // Set the ID
            bootNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;
          }

          // Create new
          return bootNotificationMongoDB.save((err, results) => {
            if (err) {
              console.log(`MongoDB: Error when creating Boot Notication of ${bootNotification.chargeBoxIdentity}: ${err.message}`);
              reject(`MongoDB: Error when creating Boot Notication of ${bootNotification.chargeBoxIdentity}: ${err.message}`);
            } else {
              console.log(`MongoDB: Boot Notication of ${bootNotification.chargeBoxIdentity} created with success`);
              fulfill(`MongoDB: Boot Notication of ${bootNotification.chargeBoxIdentity} created with success`);
            }
          });
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          reject(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    saveDataTransfer(dataTransfer) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(dataTransfer.chargeBoxIdentity).then((chargingStationMongoDB) => {
          if (chargingStationMongoDB) {
            // Create model
            var dataTransferMongoDB = new MDBDataTransfer(dataTransfer);

            // Set the ID
            dataTransferMongoDB.chargeBoxID = chargingStationMongoDB._id;

            // Create new
            dataTransferMongoDB.save((err, results) => {
              if (err) {
                console.log(`MongoDB: Error when creating Data Transfer of ${dataTransfer.chargeBoxIdentity}: ${err.message}`);
                reject(`MongoDB: Error when creating Data Transfer of ${dataTransfer.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Data Transfer of ${dataTransfer.chargeBoxIdentity} created with success`);
                fulfill(`MongoDB: Data Transfer of ${dataTransfer.chargeBoxIdentity} created with success`);
              }
            });
          } else {
            console.log(`MongoDB: Charging Station ${dataTransfer.chargeBoxIdentity} not found: Cannot add Data Transfer`);
            reject(`MongoDB: Charging Station ${dataTransfer.chargeBoxIdentity} not found: Cannot add Data Transfer`);
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          reject(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    saveConfiguration(configuration) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(configuration.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Create model
            var configurationMongoDB = new MDBConfiguration(configuration);

            // Set the ID
            configurationMongoDB.chargeBoxID = chargingStationMongoDB._id;
            configurationMongoDB.configuration = configuration.configurationKey;

            // Create new
            configurationMongoDB.save((err, results) => {
              if (err) {
                console.log(`MongoDB: Error when creating the Configuration of ${configurationMongoDB.chargeBoxIdentity}: ${err.message}`);
                reject(`MongoDB: Error when creating the Configuration of ${configurationMongoDB.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Configuration of ${configurationMongoDB.chargeBoxIdentity} created with success`);
                fulfill(`MongoDB: Configuration of ${configurationMongoDB.chargeBoxIdentity} created with success`);
              }
            });
          } else {
            console.log(`MongoDB: Charging Station ${configurationMongoDB.chargeBoxIdentity} not found: Cannot save Configuration`);
            reject(`MongoDB: Charging Station ${configurationMongoDB.chargeBoxIdentity} not found: Cannot save Configuration`);
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          reject(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    saveStatusNotification(statusNotification) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(statusNotification.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Create model
            var statusNotificationMongoDB = new MDBStatusNotification(statusNotification);

            // Set the ID
            statusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

            // Create new
            statusNotificationMongoDB.save((err, results) => {
              if (err) {
                console.log(`MongoDB: Error when creating Status Notification of ${statusNotification.chargeBoxIdentity}: ${err.message}`);
                reject(`MongoDB: Error when creating Status Notification of ${statusNotification.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Status Notification of ${statusNotification.chargeBoxIdentity} created with success`);
                fulfill(`MongoDB: Status Notification of ${statusNotification.chargeBoxIdentity} created with success`);
              }
            });
          } else {
            console.log(`MongoDB: Charging Station ${statusNotification.chargeBoxIdentity} not found: Cannot add Status Notification`);
            reject(`MongoDB: Charging Station ${statusNotification.chargeBoxIdentity} not found: Cannot add Status Notification`);
          }
        });
      });
    }

    saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(diagnosticsStatusNotification.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Create model
            var diagnosticsStatusNotificationMongoDB = new MDBDiagnosticsStatusNotification(diagnosticsStatusNotification);

            // Set the ID
            diagnosticsStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

            // Create new
            diagnosticsStatusNotificationMongoDB.save((err, results) => {
              if (err) {
                console.log(`MongoDB: Error when creating an Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity}: ${err.message}`);
                reject(`MongoDB: Error when creating an Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity} created with success`);
                fulfill(`MongoDB: Diagnostics Status Notification request of ${diagnosticsStatusNotification.chargeBoxIdentity} created with success`);
              }
            });
          } else {
            console.log(`MongoDB: Charging Station ${diagnosticsStatusNotification.chargeBoxIdentity} not found: Cannot create Diagnostics Status Notification request`);
            reject(`MongoDB: Charging Station ${diagnosticsStatusNotification.chargeBoxIdentity} not found: Cannot create Diagnostics Status Notification request`);
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          reject(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    saveFirmwareStatusNotification(firmwareStatusNotification) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(firmwareStatusNotification.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Create model
            var firmwareStatusNotificationMongoDB = new MDBFirmwareStatusNotification(firmwareStatusNotification);

            // Set the ID
            firmwareStatusNotificationMongoDB.chargeBoxID = chargingStationMongoDB._id;

            // Create new
            return firmwareStatusNotificationMongoDB.save((err, results) => {
              if (err) {
                console.log(`MongoDB: Error when creating an Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity}: ${err.message}`);
                reject(`MongoDB: Error when creating an Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity}: ${err.message}`);
              } else {
                console.log(`MongoDB: Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity} created with success`);
                fulfill(`MongoDB: Firmware Status Notification request of ${firmwareStatusNotification.chargeBoxIdentity} created with success`);
              }
            });
          } else {
            console.log(`MongoDB: Charging Station ${firmwareStatusNotification.chargeBoxIdentity} not found: Cannot create Firmware Status Notification request`);
            reject(`MongoDB: Charging Station ${firmwareStatusNotification.chargeBoxIdentity} not found: Cannot create Firmware Status Notification request`);
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          reject(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    saveAuthorize(authorize) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(authorize.chargeBoxIdentity).then((chargingStationMongoDB) => {
          if (chargingStationMongoDB) {
            // Get User
            this._getUserByTagIdMongoDB(authorize.idTag).then((userMongoDB) => {
              // Found?
              if (userMongoDB) {
                // Create model
                var authorizeMongoDB = new MDBAuthorize(authorize);

                // Set the ID
                authorizeMongoDB.chargeBoxID = chargingStationMongoDB._id;

                // Create new
                return authorizeMongoDB.save((err, results) => {
                  if (err) {
                    console.log(`MongoDB: Error when creating an Authorize request of ${authorize.chargeBoxIdentity}: ${err.message}`);
                    reject(`MongoDB: Error when creating an Authorize request of ${authorize.chargeBoxIdentity}: ${err.message}`);
                  } else {
                    console.log(`MongoDB: Authorize request of ${authorize.chargeBoxIdentity} created with success`);
                    fulfill(`MongoDB: Authorize request of ${authorize.chargeBoxIdentity} created with success`);
                  }
                });
              } else {
                console.log(`MongoDB: User with Tag ID ${authorize.idTag} not found: Cannot create Authorize request`);
                reject(`MongoDB: User with Tag ID ${authorize.idTag} not found: Cannot create Authorize request`);
              }
            });
          } else {
            console.log(`MongoDB: Charging Station ${authorize.chargeBoxIdentity} not found: Cannot create Authorize request`);
            reject(`MongoDB: Charging Station ${authorize.chargeBoxIdentity} not found: Cannot create Authorize request`);
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          reject(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    saveStartTransaction(startTransaction) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(startTransaction.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Get User
            this._getUserByTagIdMongoDB(startTransaction.idTag).then((userMongoDB) => {
              // Found?
              if (userMongoDB) {
                // Create model
                var startTransactionMongoDB = new MDBStartTransaction(startTransaction);

                // Set the IDs
                startTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;
                startTransactionMongoDB.userID = userMongoDB._id;

                // Create new
                startTransactionMongoDB.save((err, results) => {
                  if (err) {
                    console.log(`MongoDB: Error when creating Start Transaction of ${startTransaction.chargeBoxIdentity}: ${err.message}`);
                    reject(`MongoDB: Error when creating Start Transaction of ${startTransaction.chargeBoxIdentity}: ${err.message}`)
                  } else {
                    console.log(`MongoDB: Start Transaction of ${startTransaction.chargeBoxIdentity} created with success`);
                    fulfill();
                  }
                });
              } else {
                console.log(`MongoDB: User with Tag ID ${startTransaction.idTag} not found: Cannot create Start Transaction`);
                reject(`MongoDB: User with Tag ID ${startTransaction.idTag} not found: Cannot create Start Transaction`);
              }
            });
          } else {
            console.log(`MongoDB: Charging Station ${startTransaction.chargeBoxIdentity} not found: Cannot create Start Transaction`);
            reject(`MongoDB: Charging Station ${startTransaction.chargeBoxIdentity} not found: Cannot create Start Transaction`);
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          reject(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    saveStopTransaction(stopTransaction) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(stopTransaction.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            // Get User
            this._getUserByTagIdMongoDB(stopTransaction.idTag).then((userMongoDB) => {
              // Found?
              if (userMongoDB) {
                // Create model
                var stopTransactionMongoDB = new MDBStopTransaction(stopTransaction);

                // Set the ID
                stopTransactionMongoDB.chargeBoxID = chargingStationMongoDB._id;

                // Create new
                stopTransactionMongoDB.save((err, results) => {
                  if (err) {
                    console.log(`MongoDB: Error when creating Stop Transaction of ${stopTransaction.chargeBoxIdentity}: ${err.message}`);
                    reject(`MongoDB: Error when creating Stop Transaction of ${stopTransaction.chargeBoxIdentity}: ${err.message}`);
                  } else {
                    console.log(`MongoDB: Stop Transaction of ${stopTransaction.chargeBoxIdentity} created with success`);
                    fulfill(`MongoDB: Stop Transaction of ${stopTransaction.chargeBoxIdentity} created with success`);
                  }
                });
              } else {
                console.log(`MongoDB: User ${stopTransaction.idTag} not found: Cannot create Stop Transaction`);
                reject(`MongoDB: User ${stopTransaction.idTag} not found: Cannot create Stop Transaction`);
              }
            });
          } else {
            console.log(`MongoDB: Charging Station ${stopTransaction.chargeBoxIdentity} not found: Cannot create Stop Transaction`);
            reject(`MongoDB: Charging Station ${stopTransaction.chargeBoxIdentity} not found: Cannot create Stop Transaction`);
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          reject(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    saveMeterValues(meterValues) {
      // Save
      return new Promise((fulfillSave, rejectSave) => {
        // Get
        this._getChargingStationMongoDB(meterValues.chargeBoxIdentity).then((chargingStationMongoDB) => {
          // Found?
          if (chargingStationMongoDB) {
            var promises = [];

            // For each value
            meterValues.values.forEach((meterValue) => {
              // Create model
              var meterValueMongoDB = new MDBMeterValue(meterValue);

              // Set the ID
              meterValueMongoDB.chargeBoxID = chargingStationMongoDB._id;

              // Create new
              promises.push(
                // Create promise
                new Promise((fulfill, reject) => {
                  // Save
                  meterValueMongoDB.save((err, results) => {
                    if (err) {
                      console.log(`MongoDB: Error when saving Meter Value of ${meterValues.chargeBoxIdentity}: ${err.message}`);
                      reject(`MongoDB: Error when saving Meter Value of ${meterValues.chargeBoxIdentity}: ${err.message}`);
                    } else {
                      console.log(`MongoDB: Meter Value of ${meterValues.chargeBoxIdentity} created with success`);
                      fulfill();
                    }
                  });
                })
              );
            });

            // Wait for all promises
            Promise.all(promises).then(() => {
              // Nothing to do
              fulfillSave();
            }, then((err) => {
              // Err
              rejectSave(err);
            }));
          } else {
            console.log(`MongoDB: Charging Station ${meterValues.chargeBoxIdentity} not found: Cannot add Meter Value`);
            rejectSave(`MongoDB: Charging Station ${meterValues.chargeBoxIdentity} not found: Cannot add Meter Value`);
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          rejectSave(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    saveChargingStation(chargingStation) {
      // Save
      return new Promise((fulfill, reject) => {
        // Get
        this._getChargingStationMongoDB(chargingStation.getChargeBoxIdentity()).then((chargingStationMongoDB) => {
          // Found?
          if (!chargingStationMongoDB) {
            // No: Create it
            var newChargingStationMongoDB = new MDBChargingStation(chargingStation.getModel());

            // Create new
            newChargingStationMongoDB.save((err, results) => {
              if (err) {
                console.log(`MongoDB: Error when creating Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
                reject(`MongoDB: Error when creating Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
              } else {
                console.log(`MongoDB: Charging Station ${chargingStation.getChargeBoxIdentity()} created with success`);
                fulfill(`MongoDB: Charging Station ${chargingStation.getChargeBoxIdentity()} created with success`);
              }
            });
          } else {
            // Set data
            Utils.updateChargingStationObject(chargingStation.getModel(), chargingStationMongoDB);

            // No: Update it
            chargingStationMongoDB.save((err, results) => {
              if (err) {
                console.log(`MongoDB: Error when updating Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
                reject(`MongoDB: Error when updating Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
              } else {
                console.log(`MongoDB: Charging Station ${chargingStation.getChargeBoxIdentity()} updated with success`);
                fulfill(`MongoDB: Charging Station ${chargingStation.getChargeBoxIdentity()} updated with success`);
              }
            });
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
          reject(`MongoDB: Error in reading the Charging Station ${chargingStation.getChargeBoxIdentity()}: ${err.message}`);
        });
      });
    }

    getChargingStations() {
      // Get the Charging Stations
      return new Promise((fulfill, reject) => {
        // Exec request
        MDBChargingStation.find({}).sort( {chargeBoxIdentity: 1} ).exec((err, chargingStationsMongoDB) => {
          var chargingStations = [];

          if (err) {
            reject(err);
          } else {
            // Create
            chargingStationsMongoDB.forEach((chargingStationMongoDB) => {
              chargingStations.push(new ChargingStation(chargingStationMongoDB));
            });
            // Ok
            fulfill(chargingStations);
          }
        });
      });
    }

    getChargingStation(chargeBoxIdentity) {
      // Get
      return this._getChargingStationMongoDB(chargeBoxIdentity).then((chargingStationMongoDB) => {
        var chargingStation = null;

        // Found
        if (chargingStationMongoDB != null) {
          // Create
          chargingStation = new ChargingStation(chargingStationMongoDB);
        }

        return chargingStation;
      }).catch((err) => {
        console.log(`MongoDB: Error in reading the Charging Station ${chargeBoxIdentity}: ${err.message}`);
      });
    }

    _getChargingStationMongoDB(chargeBoxIdentity) {
      // Get the Charging Station
      return new Promise((fulfill, reject) => {
        // Exec request
        MDBChargingStation.find({"chargeBoxIdentity": chargeBoxIdentity}, (err, chargingStationsMongoDB) => {
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
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Charing Station ${chargeBoxIdentity}: ${err.message}`);
          reject(`MongoDB: Error in reading the User ${chargeBoxIdentity}: ${err.message}`);
        });
      });
    }

    getUsers() {
      // Get the Users
      return new Promise((fulfill, reject) => {
        // Exec request
        MDBUser.find({}).sort( {name: 1} ).exec((err, usersMongoDB) => {
          var users = [];

          if (err) {
            reject(err);
          } else {
            // Create
            usersMongoDB.forEach((userMongoDB) => {
              users.push(new User(userMongoDB));
            });
            // Ok
            fulfill(users);
          }
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the Users: ${err.message}`);
          reject(`MongoDB: Error in reading the Users: ${err.message}`);
        });
      });
    }

    saveUser(user) {
      return new Promise((fulfill, reject) => {
        // Check
        if (!user.getTagID()) {
          console.log("User has no Tag ID and cannot be created or updated");
          reject("User has no Tag ID and cannot be created or updated");
        } else {
          // Get
          this._getUserByTagIdMongoDB(user.getTagID()).then((userMongoDB) => {
            // Found?
            if (!userMongoDB) {
              // No: Create it
              var newUserMongoDB = new MDBUser(user.getModel());

              // Create new
              newUserMongoDB.save((err, results) => {
                if (err) {
                  console.log(`MongoDB: Error when creating User  ${user.getName()}: ${err.message}`);
                  reject(`MongoDB: Error when creating User  ${user.getName()}: ${err.message}`);
                } else {
                  console.log(`MongoDB: User ${user.getName()} created with success`);
                  fulfill(`MongoDB: User ${user.getName()} created with success`);
                }
              });
            } else {
              // Set data
              Utils.updateUser(user.getModel(), userMongoDB);

              // No: Update it
              userMongoDB.save((err, results) => {
                if (err) {
                  console.log(`MongoDB: Error when updating User ${user.getName()}: ${err.message}`);
                  reject(`MongoDB: Error when updating User ${user.getName()}: ${err.message}`)
                } else {
                  console.log(`MongoDB: User ${user.getName()} updated with success`);
                  fulfill(`MongoDB: User ${user.getName()} updated with success`);
                }
              });
            }
          }).catch((err) => {
            console.log(`MongoDB: Error in reading the User ${user.getName()}: ${err.message}`);
            reject(`MongoDB: Error in reading the User ${user.getName()}: ${err.message}`);
          });
        }
      });
    }

    getTransactions(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
      // // Get the Charging Station
      // return new Promise((fulfill, reject) => {
      //     // Build filter
      //     var filter = {};
      //     if (chargeBoxIdentity) {
      //       filter.chargeBoxIdentity = chargeBoxIdentity;
      //     }
      //     if (connectorId) {
      //       filter.connectorId = connectorId;
      //     }
      //     if (startDateTime || endDateTime) {
      //       filter.timestamp = {};
      //     }
      //     if (startDateTime) {
      //       filter.timestamp["$gte"] = new Date(startDateTime);
      //     }
      //     if (endDateTime) {
      //       filter.timestamp["$lte"] = new Date(endDateTime);
      //     }
      //
      //     // Get the Start Transaction
      //     MDBStartTransaction.find(filter).sort( {timestamp: -1} ).exec((err, transactionsMongoDB) => {
      //         var transactions = [];
      //
      //         if (err) {
      //             reject(err);
      //         } else {
      //             // Create
      //             transactionsMongoDB.forEach((transactionMongoDB) => {
      //               var transaction = {};
      //               // Set
      //               Utils.updateStartTransaction(transactionMongoDB, transaction);
      //               // Add
      //               transactions.push(transaction);
      //             });
      //             // Ok
      //             fulfill(transactions);
      //         }
      //     // Get the Users
      //   }).then((transactions) => {
      //       var userPromises = [];
      //
      //       // Get the user for each transaction
      //       for (var i = 0; i < transactions.length; i++) {
      //         // Call in a function to pass the index in the Promise
      //         ((transaction) => {
      //           // Get the user
      //           userPromises.push(
      //             // Get the user
      //             this.getUserByTagId(transaction.idTag).then((user) => {
      //               // Set
      //               if(user) {
      //                 // Set the User
      //                 transaction.user = user.getModel();
      //               }
      //               return transaction;
      //             })
      //           );
      //         })(transactions[i]);
      //       }
      //
      //       Promise.all(userPromises).then((transactions) => {
      //         fullfill(transactions);
      //       });
      //     });
      // });
    }

    getUserByTagId(tagID) {
      return new Promise((fulfill, reject) => {
        // Get
        this._getUserByTagIdMongoDB(tagID).then((userMongoDB) => {
          var user = null;

          // Found
          if (userMongoDB != null) {
            user = new User(userMongoDB);
          }

          fulfill(user);
        }).catch((err) => {
          console.log(`MongoDB: Error in reading the User with Tag ID ${tagID}: ${err.message}`);
          reject(`MongoDB: Error in reading the User with Tag ID ${tagID}: ${err.message}`);
        });
      });
    }

    _getUserByTagIdMongoDB(tagID) {
      // Get the Charging Station
      return new Promise((fulfill, reject) => {
        // Exec request
        MDBUser.find({"tagID": tagID}, (err, usersMongoDB) => {
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
