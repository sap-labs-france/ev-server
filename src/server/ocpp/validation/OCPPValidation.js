const Utils = require('../../../utils/Utils');
const Constants = require('../../../utils/Constants');
const BackendError = require('../../../exception/BackendError');
const Logging = require('../../../utils/Logging');
const SchemaValidator = require('../../rest/validation/SchemaValidator');
const bootNotificationRequest = require('./boot-notification-request.json');
const authorizeRequest = require('./authorize-request.json');
const statusNotificationRequest = require('./status-notification-request.json');
const startTransactionRequest = require('./start-transaction-request.json');
const stopTransactionRequest16 = require('./stop-transaction-request-16.json');
const stopTransactionRequest15 = require('./stop-transaction-request-15.json');

require('source-map-support').install();

class OCPPValidation extends SchemaValidator {

  constructor() {
    if (!OCPPValidation.instance) {
      super("OCPPValidation");
      OCPPValidation.instance = this;
    }

    return OCPPValidation.instance;
  }

  validateHeartbeat(heartbeat) {
  }

  validateStatusNotification(statusNotification) {
    // Check non mandatory timestamp
    if (!statusNotification.timestamp) {
      statusNotification.timestamp = new Date().toISOString();
    }
    this.validate(statusNotificationRequest, statusNotification);
  }

  validateAuthorize(authorize) {
    this.validate(authorizeRequest, authorize);
  }

  validateBootNotification(bootNotification) {
    this.validate(bootNotificationRequest, bootNotification);
  }

  validateDiagnosticsStatusNotification(chargingStation, diagnosticsStatusNotification) {
  }

  validateFirmwareStatusNotification(chargingStation, firmwareStatusNotification) {
  }

  validateStartTransaction(chargingStation, startTransaction) {
    // // Check the timestamp
    // if (!startTransaction.hasOwnProperty("timestamp")) {
    //   // BUG EBEE: Timestamp is mandatory according OCPP
    //   throw new BackendError(chargingStation.getID(),
    //     `The 'timestamp' property has not been provided`,
    //     "OCPPValidation", "validateStartTransaction", Constants.ACTION_START_TRANSACTION);
    // }
    // // Check the meter start
    // if (!startTransaction.hasOwnProperty("meterStart")) {
    //   // BUG EBEE: MeterStart is mandatory according OCPP
    //   throw new BackendError(chargingStation.getID(),
    //     `The 'meterStart' property has not been provided`,
    //     "OCPPValidation", "validateStartTransaction", Constants.ACTION_START_TRANSACTION);
    // }
    // // Check Tag ID
    // if (!startTransaction.idTag) {
    //   throw new BackendError(chargingStation.getID(),
    //     `The 'idTag' property has not been provided`,
    //     "OCPPValidation", "validateStartTransaction", Constants.ACTION_START_TRANSACTION);
    // }
    // // Always integer
    // startTransaction.connectorId = Utils.convertToInt(startTransaction.connectorId);

    this.validate(startTransactionRequest, startTransaction);
    // Check Connector ID
    if (!chargingStation.getConnector(startTransaction.connectorId)) {
      throw new BackendError(chargingStation.getID(),
        `The Connector ID '${startTransaction.connectorId}' is invalid`,
        'OCPPService', 'handleStartTransaction', Constants.ACTION_START_TRANSACTION);
    }
  }

  validateDataTransfer(chargingStation, dataTransfer) {
  }

  validateStopTransaction(chargingStation, stopTransaction) {
    if (chargingStation.getOcppVersion() === Constants.OCPP_VERSION_16) {
      this.validate(stopTransactionRequest16, stopTransaction);
    } else {
      this.validate(stopTransactionRequest15, stopTransaction);
    }
  }

  validateMeterValues(chargingStation, meterValues) {
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

const instance = new OCPPValidation();
Object.freeze(instance);

module.exports = instance;
