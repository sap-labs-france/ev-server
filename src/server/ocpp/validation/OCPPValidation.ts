import BackendError from '../../../exception/BackendError';
import Constants from '../../../utils/Constants';
import TSGlobal from '../../../types/GlobalType';
import Logging from '../../../utils/Logging';
import SchemaValidator from '../../rest/validation/SchemaValidator';
import fs from 'fs';
import global from '../../../types/GlobalType';
import SourceMap from 'source-map-support';
import Utils from '../../../utils/Utils';
SourceMap.install();
export default class OCPPValidation extends SchemaValidator {
  private static instance: OCPPValidation|null = null;

  public validate: any;
  private _bootNotificationRequest: any;
  private _authorizeRequest: any;
  private _statusNotificationRequest: any;
  private _startTransactionRequest: any;
  private _stopTransactionRequest16: any;
  private _stopTransactionRequest15: any;

  constructor() {
    super('OCPPValidation');
    this._bootNotificationRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/validation/boot-notification-request.json`, 'utf8'));
    this._authorizeRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/validation/authorize-request.json`, 'utf8'));
    this._statusNotificationRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/validation/status-notification-request.json`, 'utf8'));
    this._startTransactionRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/validation/start-transaction-request.json`, 'utf8'));
    this._stopTransactionRequest15 = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/validation/stop-transaction-request-15.json`, 'utf8'));
    this._stopTransactionRequest16 = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/validation/stop-transaction-request-16.json`, 'utf8'));
  }

  static getInstance(): OCPPValidation {
    if (!OCPPValidation.instance) {
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
    this.validate(this._statusNotificationRequest, statusNotification);
  }

  validateAuthorize(authorize) {
    this.validate(this._authorizeRequest, authorize);
  }

  validateBootNotification(bootNotification) {
    this.validate(this._bootNotificationRequest, bootNotification);
  }

  validateDiagnosticsStatusNotification(chargingStation, diagnosticsStatusNotification) {
  }

  validateFirmwareStatusNotification(chargingStation, firmwareStatusNotification) {
  }

  validateStartTransaction(chargingStation, startTransaction) {
    this.validate(this._startTransactionRequest, startTransaction);
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
      this.validate(this._stopTransactionRequest16, stopTransaction);
    } else {
      this.validate(this._stopTransactionRequest15, stopTransaction);
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
        action: 'MeterValues', message: 'Connector ID must not be \'0\' and has been reset to \'1\''
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

