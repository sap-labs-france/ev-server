var MongoDBStorage = require('./mongodb/MongoDBStorage');
var Utils = require('../utils/Utils');
var Storage = require('./Storage');

class StorageFacade {
  // Create the database connection
  constructor(storageConfigs) {
    // Init
    global.alternateStorages = [];
    // Instanciate storages
    storageConfigs.forEach((storageConfig) => {
      // Check implementation
      switch (storageConfig.implementation) {
        // SOAP
        case 'mongodb':
          var mongoDB = new MongoDBStorage(storageConfig);
          if (storageConfig.leading) {
            global.leadingStorage = mongoDB;
          } else {
            global.alternateStorages.push(mongoDB);
          }
          break;

        default:
          console.log(`Storage Server implementation ${storageConfig.implementation} not found!`);
      }
    });
  }

  start() {
    // Create central storage facade access
    global.storage = this;

    // Start others async
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.start();
    });

    // Start the leading storage
    return global.leadingStorage.start();
  }

  saveChargingStation(chargingStation) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveChargingStation(chargingStation);
    });

    // Save in main DB
    return global.leadingStorage.saveChargingStation(chargingStation);
  }

  getMeterValues(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
    // Delegate
    return global.leadingStorage.getMeterValues(chargeBoxIdentity, connectorId, startDateTime, endDateTime);
  }

  getLastMeterValuesFromTransaction(chargeBoxIdentity, connectorId, transactionId, limit) {
    // Delegate
    return global.leadingStorage.getLastMeterValuesFromTransaction(chargeBoxIdentity, connectorId, transactionId, limit);
  }

  getChargingStation(chargeBoxIdentity) {
    // Delegate
    return global.leadingStorage.getChargingStation(chargeBoxIdentity);
  }

  getChargingStations() {
    // Delegate
    return global.leadingStorage.getChargingStations();
  }

  getUserByEmailPassword(email, password) {
    // Delegate
    return global.leadingStorage.getUserByEmailPassword(email, password);
  }

  saveStatusNotification(statusNotification) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveStatusNotification(statusNotification);
    });

    // Delegate
    return global.leadingStorage.saveStatusNotification(statusNotification);
  }

  getStatusNotifications(chargeBoxIdentity, connectorId) {
    // Delegate
    return global.leadingStorage.getStatusNotifications(chargeBoxIdentity, connectorId);
  }

  getLastStatusNotification(chargeBoxIdentity, connectorId) {
    // Delegate
    return global.leadingStorage.getLastStatusNotification(chargeBoxIdentity, connectorId);
  }

  getConfigurationParamValue(chargeBoxIdentity, paramName) {
    // Delegate
    return global.leadingStorage.getConfigurationParamValue(chargeBoxIdentity, paramName);
  }

  saveFirmwareStatusNotification(firmwareStatusNotification){
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveFirmwareStatusNotification(firmwareStatusNotification);
    });

    // Delegate
    return global.leadingStorage.saveFirmwareStatusNotification(firmwareStatusNotification);
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveDiagnosticsStatusNotification(diagnosticsStatusNotification);
    });

    // Delegate
    return global.leadingStorage.saveDiagnosticsStatusNotification(diagnosticsStatusNotification);
  }

  saveUser(user) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveUser(user);
    });

    // Delegate
    return global.leadingStorage.saveUser(user);
  }

  saveAuthorize(authorize) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveAuthorize(authorize);
    });

    // Delegate
    return global.leadingStorage.saveAuthorize(authorize);
  }

  saveMeterValues(meterValues) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveMeterValues(meterValues);
    });

    // Delegate
    return global.leadingStorage.saveMeterValues(meterValues);
  }

  saveStartTransaction(startTransaction) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveStartTransaction(startTransaction);
    });

    // Delegate
    return global.leadingStorage.saveStartTransaction(startTransaction);
  }

  saveStopTransaction(stopTransaction) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveStopTransaction(stopTransaction);
    });

    // Delegate
    return global.leadingStorage.saveStopTransaction(stopTransaction);
  }

  saveBootNotification(bootNotification) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveBootNotification(bootNotification);
    });

    // Delegate
    return global.leadingStorage.saveBootNotification(bootNotification);
  }

  saveDataTransfer(dataTransfer) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveDataTransfer(dataTransfer);
    });

    // Delegate
    return global.leadingStorage.saveDataTransfer(dataTransfer);
  }

  getConfiguration(chargeBoxIdentity) {
    // Delegate
    return global.leadingStorage.getConfiguration(chargeBoxIdentity);
  }

  saveConfiguration(configuration) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveConfiguration(configuration);
    });

    // Delegate
    return global.leadingStorage.saveConfiguration(configuration);
  }

  getUsers() {
    // Delegate
    return global.leadingStorage.getUsers();
  }

  getTransactions(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
    // Delegate
    return global.leadingStorage.getTransactions(chargeBoxIdentity, connectorId, startDateTime, endDateTime);
  }

  getLastTransaction(chargeBoxIdentity, connectorId) {
    // Delegate
    return global.leadingStorage.getLastTransaction(chargeBoxIdentity, connectorId);
  }

  getLogs(numberOfLogging) {
    // Delegate
    return global.leadingStorage.getLogs(numberOfLogging);
  }

  getUserByEmail(email) {
    // Delegate
    return global.leadingStorage.getUserByEmail(email);
  }

  getUserByTagId(tagID) {
    // Delegate
    return global.leadingStorage.getUserByTagId(tagID);
  }

  getUser(id) {
    // Delegate
    return global.leadingStorage.getUser(id);
  }

  deleteUser(id) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.deleteUser(id);
    });

    // Delegate
    return global.leadingStorage.deleteUser(id);
  }

  saveLog(log) {
    // Delegate
    global.alternateStorages.forEach((storage) => {
      // Trigger Save for other DB
      storage.saveLog(log);
    });

    // Delegate
    return global.leadingStorage.saveLog(log);
  }
}

module.exports=StorageFacade;
