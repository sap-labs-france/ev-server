import Utils from '../../../utils/Utils';
import Constants from '../../../utils/Constants';
import BackendError from '../../../exception/BackendError';
import Logging from '../../../utils/Logging';
import SchemaValidator from '../../rest/validation/SchemaValidator';
import bootNotificationRequest from './boot-notification-request.json';
import authorizeRequest from './authorize-request.json';
import statusNotificationRequest from './status-notification-request.json';
import startTransactionRequest from './start-transaction-request.json';
import stopTransactionRequest16 from './stop-transaction-request-16.json';
import stopTransactionRequest15 from './stop-transaction-request-15.json';

require('source-map-support').install();
export default class OCPPValidation extends SchemaValidator {
	public validate: any;

  constructor() {
    super('OCPPValidation');
  }

  private static instance: OCPPValidation|null = null;
  static getInstance(): OCPPValidation {
    if(OCPPValidation.instance == null) {
      OCPPValidation.instance = new OCPPValidation();
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
    //     "OCPPValidation", "validateStartTransaction", Constants.ACTION_REMOTE_START_TRANSACTION);
    // }
    // // Check the meter start
    // if (!startTransaction.hasOwnProperty("meterStart")) {
    //   // BUG EBEE: MeterStart is mandatory according OCPP
    //   throw new BackendError(chargingStation.getID(),
    //     `The 'meterStart' property has not been provided`,
    //     "OCPPValidation", "validateStartTransaction", Constants.ACTION_REMOTE_START_TRANSACTION);
    // }
    // // Check Tag ID
    // if (!startTransaction.idTag) {
    //   throw new BackendError(chargingStation.getID(),
    //     `The 'idTag' property has not been provided`,
    //     "OCPPValidation", "validateStartTransaction", Constants.ACTION_REMOTE_START_TRANSACTION);
    // }
    // // Always integer
    // startTransaction.connectorId = Utils.convertToInt(startTransaction.connectorId);

    this.validate(startTransactionRequest, startTransaction);
    // Check Connector ID
    if (!chargingStation.getConnector(startTransaction.connectorId)) {
      throw new BackendError(chargingStation.getID(),
        `The Connector ID '${startTransaction.connectorId}' is invalid`,
        'OCPPService', 'handleStartTransaction', Constants.ACTION_REMOTE_START_TRANSACTION);
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

