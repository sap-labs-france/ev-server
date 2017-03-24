var MongoDBStorage = require('./mongodb/MongoDBStorage');
var Utils = require('../utils/Utils');
var Storage = require('./Storage');

let _storages = [];
let _leadingStorage;

class StorageFacade extends Storage {
  constructor(dbConfig) {
    super(dbConfig);

    // Read conf
    var storageConfigs = Utils.getStoragesConfig();
    var that = this;

    // Instanciate
    storageConfigs.forEach(function(storageConfig) {
      // Check implementation
      switch (storageConfig.implementation) {
        // SOAP
        case 'mongodb':
          var mongoDB = new MongoDBStorage(storageConfig);
          if (storageConfig.leading) {
            _leadingStorage = mongoDB;
          } else {
            _storages.push(mongoDB);
          }
          break;

        default:
          console.log(`Storage Server implementation ${storageConfig.implementation} not found!`);
      }
    });
  }

  saveChargingStation(chargingStation) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveChargingStation(chargingStation);
    });

    // Save in main DB
    return _leadingStorage.saveChargingStation(chargingStation);
  }

  getMeterValues(chargeBoxIdentity, connectorId, transactionId, startDateTime, endDateTime) {
    // Delegate
    return _leadingStorage.getMeterValues(chargeBoxIdentity, connectorId, transactionId, startDateTime, endDateTime);
  }

  getChargingStation(chargeBoxIdentity) {
    // Delegate
    return _leadingStorage.getChargingStation(chargeBoxIdentity);
  }

  getChargingStations() {
    // Delegate
    return _leadingStorage.getChargingStations();
  }

  saveStatusNotification(statusNotification) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveStatusNotification(statusNotification);
    });

    // Delegate
    return _leadingStorage.saveStatusNotification(statusNotification);
  }

  getStatusNotifications(chargeBoxIdentity, connectorId) {
    // Delegate
    return _leadingStorage.getStatusNotifications(chargeBoxIdentity, connectorId);
  }

  getLastStatusNotification(chargeBoxIdentity, connectorId) {
    // Delegate
    return _leadingStorage.getLastStatusNotification(chargeBoxIdentity, connectorId);
  }

  getConfigurationParamValue(chargeBoxIdentity, paramName) {
    // Delegate
    return _leadingStorage.getConfigurationParamValue(chargeBoxIdentity, paramName);
  }

  saveFirmwareStatusNotification(firmwareStatusNotification){
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveFirmwareStatusNotification(firmwareStatusNotification);
    });

    // Delegate
    return _leadingStorage.saveFirmwareStatusNotification(firmwareStatusNotification);
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveDiagnosticsStatusNotification(diagnosticsStatusNotification);
    });

    // Delegate
    return _leadingStorage.saveDiagnosticsStatusNotification(diagnosticsStatusNotification);
  }

  saveUser(user) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveUser(user);
    });

    // Delegate
    return _leadingStorage.saveUser(user);
  }

  saveAuthorize(authorize) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveAuthorize(authorize);
    });

    // Delegate
    return _leadingStorage.saveAuthorize(authorize);
  }

  saveMeterValues(meterValues) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveMeterValues(meterValues);
    });

    // Delegate
    return _leadingStorage.saveMeterValues(meterValues);
  }

  saveStartTransaction(startTransaction) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveStartTransaction(startTransaction);
    });

    // Delegate
    return _leadingStorage.saveStartTransaction(startTransaction);
  }

  saveStopTransaction(stopTransaction) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveStopTransaction(stopTransaction);
    });

    // Delegate
    return _leadingStorage.saveStopTransaction(stopTransaction);
  }

  saveBootNotification(bootNotification) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveBootNotification(bootNotification);
    });

    // Delegate
    return _leadingStorage.saveBootNotification(bootNotification);
  }

  saveDataTransfer(dataTransfer) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveDataTransfer(dataTransfer);
    });

    // Delegate
    return _leadingStorage.saveDataTransfer(dataTransfer);
  }

  getConfiguration(chargeBoxIdentity) {
    // Delegate
    return _leadingStorage.getConfiguration(chargeBoxIdentity);
  }

  saveConfiguration(configuration) {
    // Delegate
    _storages.forEach(function(storage) {
      // Trigger Save for other DB
      storage.saveConfiguration(configuration);
    });

    // Delegate
    return _leadingStorage.saveConfiguration(configuration);
  }
}

module.exports=StorageFacade;
