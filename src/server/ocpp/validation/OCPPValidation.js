const Utils = require('../../../utils/Utils');
const BackendError = require('../../../exception/BackendError');

require('source-map-support').install();

class OCPPValidation {

  static validateHeartbeat(chargingStation, heartbeat) {
  }

  static validateStatusNotification(chargingStation, statusNotification) {
    // Check non mandatory timestamp
    if (!statusNotification.timestamp) {
      statusNotification.timestamp = new Date().toISOString();
    }
    // Always integer
    statusNotification.connectorId = Utils.convertToInt(statusNotification.connectorId);
  }

  static validateAuthorize(chargingStation, authorize) {
  }

  static validateBootNotification(bootNotification) {
  }

  static validateDiagnosticsStatusNotification(chargingStation, diagnosticsStatusNotification) {
  }

  static validateFirmwareStatusNotification(chargingStation, firmwareStatusNotification) {
  }

  static validateStartTransaction(chargingStation, startTransaction) {
    // Check the timestamp
    if (!startTransaction.hasOwnProperty("timestamp")) {
      // BUG EBEE: Timestamp is mandatory according OCPP
      throw new BackendError(chargingStation.getID(),
        `The 'timestamp' property has not been provided`,
        "OCPPValidation", "validateStartTransaction", "StartTransaction");
    }
    // Check the meter start
    if (!startTransaction.hasOwnProperty("meterStart")) {
      // BUG EBEE: MeterStart is mandatory according OCPP
      throw new BackendError(chargingStation.getID(),
        `The 'meterStart' property has not been provided`,
        "OCPPValidation", "validateStartTransaction", "StartTransaction");
    }
    // Check Tag ID
    if (!startTransaction.idTag) {
      throw new BackendError(chargingStation.getID(),
        `The 'idTag' property has not been provided`,
        "OCPPValidation", "validateStartTransaction", "StartTransaction");
    }
    // Always integer
    startTransaction.connectorId = Utils.convertToInt(startTransaction.connectorId);
  }

  static validateDataTransfer(chargingStation, dataTransfer) {
  }

  static validateStopTransaction(chargingStation, stopTransaction) {
  }
}

module.exports = OCPPValidation;
