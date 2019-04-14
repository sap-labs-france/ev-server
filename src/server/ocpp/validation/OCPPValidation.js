const Utils = require('../../../utils/Utils');
const BackendError = require('../../../exception/BackendError');
const Logging = require('../../../utils/Logging');

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

  static validateMeterValues(chargingStation, meterValues) {
    // Always integer
    meterValues.connectorId = Utils.convertToInt(meterValues.connectorId);
    // Check Connector ID
    if (meterValues.connectorId === 0) {
      // BUG KEBA: Connector ID must be > 0 according OCPP
      Logging.logWarning({
        tenantID: chargingStation.getTenantID(),
        source: chargingStation.getID(), module: 'OCPPValidation', method: 'validateMeterValues',
        action: 'MeterValues', message: `Connector ID must not be '0' and has been reset to '1'`
      });
      // Set to 1 (KEBA has only one connector)
      meterValues.connectorId = 1;
    }    
    // Check if the transaction ID matches
    const chargerTransactionId = Utils.convertToInt(chargingStation.getConnector(meterValues.connectorId).activeTransactionID);
    // Transaction is provided in MeterValue?
    if (meterValues.hasOwnProperty('transactionId')) {
      // Always integer
      meterValues.transactionId = Utils.convertToInt(meterValues.transactionId);
      // Yes: Check Transaction ID (ABB)
      if (meterValues.transactionId !== chargerTransactionId) {
        // Check if valid
        if (chargerTransactionId > 0) {
          // No: Log that the transaction ID will be reused
          Logging.logWarning({
            tenantID: chargingStation.getTenantID(), source: chargingStation.getID(),
            module: 'OCPPValidation', method: 'validateMeterValues', action: 'MeterValues',
            message: `Transaction ID '${meterValues.transactionId}' not found but retrieved from StartTransaction '${chargerTransactionId}'`
          });
        }
        // Always assign, even if equals to 0
        meterValues.transactionId = chargerTransactionId;
      }
      // Transaction is not provided: check if there is a transaction assigned on the connector
    } else if (chargerTransactionId > 0) {
      // Yes: Use Connector's Transaction ID
      Logging.logWarning({
        tenantID: chargingStation.getTenantID(), source: chargingStation.getID(),
        module: 'OCPPValidation', method: 'validateMeterValues', action: 'MeterValues',
        message: `Transaction ID is not provided but retrieved from StartTransaction '${chargerTransactionId}'`
      });
      // Override it
      meterValues.transactionId = chargerTransactionId;
    }
  }
}

module.exports = OCPPValidation;
