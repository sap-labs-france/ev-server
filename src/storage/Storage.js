class Storage {
  constructor(dbConfig) {
    if (new.target === Storage) {
      throw new TypeError("Cannot construct Storage instances directly");
    }
  }

  start() {
  }

  setCentralRestServer(centralRestServer) {
  }

  getLogs(numberOfLogging) {
  }

  saveLog(log) {
  }

  getUsers() {
  }

  getUserByTagId(tagID) {
  }

  getUserByEmail(email) {
  }

  getUserByEmailPassword(email, password) {
  }

  getUser(id) {
  }

  saveUser(user) {
  }

  deleteUser(id) {
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

  getMeterValuesFromDateTimeRange(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
  }

  getLastMeterValuesFromTransaction(chargeBoxIdentity, connectorId, transactionId, limit) {
  }

  getLastTransaction(chargeBoxIdentity, connectorId) {
  }

  getTransactions(chargeBoxIdentity, connectorId, startDateTime, endDateTime) {
  }

  saveStartTransaction(startTransaction) {
  }

  saveStopTransaction(stopTransaction) {
  }

  saveDataTransfer(dataTransfer) {
  }

  saveDiagnosticsStatusNotification(diagnosticsStatusNotification) {
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
