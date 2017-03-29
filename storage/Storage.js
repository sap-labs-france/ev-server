class Storage {
  constructor(dbConfig) {
    if (new.target === Storage) {
      throw new TypeError("Cannot construct Storage instances directly");
    }
  }

  getUsers() {
  }

  getUserByTagID(tagID) {
  }

  saveUser(user) {
  }

  getChargingStations() {
  }

  getChargingStation(chargeBoxIdentity) {
  }

  saveChargingStation(chargingStation) {
  }

  saveBootNotification(bootNotification) {
  }

  saveStatusNotification(statusNotification) {
  }

  getStatusNotifications(chargeBoxIdentity, connectorId) {
  }

  getLastStatusNotification(chargeBoxIdentity, connectorId) {
  }

  saveMeterValues(meterValues) {
  }

  getMeterValues(chargeBoxIdentity, connectorId, transactionId, startDateTime, endDateTime) {
  }

  saveStartTransaction(startTransaction) {
  }

  saveStopTransaction(stopTransaction) {
  }

  saveDataTransfer(dataTransfer) {
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
  }

  saveUser(user) {
  }

  saveFirmwareStatusNotification(firmwareStatusNotification) {
  }

  saveAuthorize(authorize) {
  }

  getConfiguration(chargeBoxIdentity) {
  }

  getConfigurationParamValue(chargeBoxIdentity, paramName) {
  }

  saveConfiguration(configuration) {
  }
}

module.exports=Storage;
