import { OCPPAuthorizeRequestExtended, OCPPBootNotificationRequestExtended, OCPPDataTransferRequestExtended, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationRequestExtended, OCPPHeartbeatRequestExtended, OCPPMeterValuesExtended, OCPPStatusNotificationRequestExtended, OCPPStopTransactionRequestExtended, OCPPVersion } from '../../../types/ocpp/OCPPServer';

import BackendError from '../../../exception/BackendError';
import ChargingStation from '../../../types/ChargingStation';
import Logging from '../../../utils/Logging';
import SchemaValidator from '../../rest/v1/validator/SchemaValidator';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
import fs from 'fs';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'OCPPValidation';

export default class OCPPValidation extends SchemaValidator {
  private static instance: OCPPValidation|null = null;

  public validate: any;
  private _bootNotificationRequest: any;
  private _authorizeRequest: any;
  private _statusNotificationRequest: any;
  private _startTransactionRequest: any;
  private _stopTransactionRequest16: any;
  private _stopTransactionRequest15: any;

  private constructor() {
    super('OCPPValidation');
    this._bootNotificationRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/boot-notification-request.json`, 'utf8'));
    this._authorizeRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/authorize-request.json`, 'utf8'));
    this._statusNotificationRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/status-notification-request.json`, 'utf8'));
    this._startTransactionRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/start-transaction-request.json`, 'utf8'));
    this._stopTransactionRequest15 = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/stop-transaction-request-15.json`, 'utf8'));
    this._stopTransactionRequest16 = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/stop-transaction-request-16.json`, 'utf8'));
  }

  static getInstance(): OCPPValidation {
    if (!OCPPValidation.instance) {
      OCPPValidation.instance = new OCPPValidation();
    }
    return OCPPValidation.instance;
  }

  validateHeartbeat(heartbeat: OCPPHeartbeatRequestExtended): void {
  }

  validateStatusNotification(statusNotification: OCPPStatusNotificationRequestExtended): void {
    // Check non mandatory or wrong timestamp
    if (!statusNotification.timestamp || new Date(statusNotification.timestamp).getFullYear() === new Date(0).getFullYear()) {
      statusNotification.timestamp = new Date().toISOString();
    }
    this.validate(this._statusNotificationRequest, statusNotification);
  }

  validateAuthorize(authorize: OCPPAuthorizeRequestExtended): void {
    this.validate(this._authorizeRequest, authorize);
  }

  validateBootNotification(bootNotification: OCPPBootNotificationRequestExtended): void {
    this.validate(this._bootNotificationRequest, bootNotification);
  }

  validateDiagnosticsStatusNotification(chargingStation: ChargingStation,
    diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequestExtended): void {
  }

  validateFirmwareStatusNotification(chargingStation: ChargingStation,
    firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended): void {
  }

  validateStartTransaction(chargingStation: ChargingStation, startTransaction): void {
    this.validate(this._startTransactionRequest, startTransaction);
    // Check Connector ID
    if (!Utils.getConnectorFromID(chargingStation, startTransaction.connectorId)) {
      throw new BackendError({
        source: chargingStation.id,
        module: MODULE_NAME, method: 'validateStartTransaction',
        message: `The Connector ID '${startTransaction.connectorId}' is invalid`,
        action: ServerAction.START_TRANSACTION
      });
    }
  }

  validateDataTransfer(chargingStation: ChargingStation, dataTransfer: OCPPDataTransferRequestExtended): void {
  }

  validateStopTransaction(chargingStation: ChargingStation, stopTransaction: OCPPStopTransactionRequestExtended): void {
    if (chargingStation.ocppVersion === OCPPVersion.VERSION_16) {
      this.validate(this._stopTransactionRequest16, stopTransaction);
    } else {
      this.validate(this._stopTransactionRequest15, stopTransaction);
    }
  }

  validateMeterValues(tenantID: string, chargingStation: ChargingStation, meterValues: OCPPMeterValuesExtended): void {
    // Always integer
    meterValues.connectorId = Utils.convertToInt(meterValues.connectorId);
    // Check Connector ID
    if (meterValues.connectorId === 0) {
      // KEBA: Connector ID must be > 0 according to OCPP
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'validateMeterValues',
        action: ServerAction.METER_VALUES,
        message: 'Connector ID must not be \'0\' and has been reset to \'1\''
      });
      // Set to 1 (KEBA has only one connector)
      meterValues.connectorId = 1;
    }
    // Check if the transaction ID matches
    const foundConnector = Utils.getConnectorFromID(chargingStation, meterValues.connectorId);
    if (!foundConnector) {
      Logging.logWarning({
        tenantID: tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'validateMeterValues',
        action: ServerAction.METER_VALUES,
        message: `Connector ID '${meterValues.connectorId}' not found in charging station for transaction '${meterValues.transactionId}'`
      });
    }
    const chargerTransactionId = Utils.convertToInt(foundConnector ? foundConnector.currentTransactionID : 0);
    // Transaction is provided in MeterValue?
    if (Utils.objectHasProperty(meterValues, 'transactionId')) {
      // Always integer
      meterValues.transactionId = Utils.convertToInt(meterValues.transactionId);
      // Yes: Check Transaction ID (ABB)
      if (meterValues.transactionId !== chargerTransactionId) {
        // Check if valid
        if (chargerTransactionId > 0) {
          // No: Log that the transaction ID will be reused
          Logging.logWarning({
            tenantID: tenantID,
            source: chargingStation.id,
            module: MODULE_NAME, method: 'validateMeterValues',
            action: ServerAction.METER_VALUES,
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
        tenantID: tenantID,
        source: chargingStation.id,
        module: MODULE_NAME, method: 'validateMeterValues',
        action: ServerAction.METER_VALUES,
        message: `Transaction ID is not provided but retrieved from StartTransaction '${chargerTransactionId}'`
      });
      // Override it
      meterValues.transactionId = chargerTransactionId;
    }
  }
}

