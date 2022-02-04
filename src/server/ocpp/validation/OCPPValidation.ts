import { OCPPAuthorizeRequestExtended, OCPPBootNotificationRequestExtended, OCPPDataTransferRequestExtended, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationRequestExtended, OCPPHeartbeatRequestExtended, OCPPMeterValuesRequestExtended, OCPPStartTransactionRequestExtended, OCPPStatusNotificationRequestExtended, OCPPStopTransactionRequestExtended, OCPPVersion } from '../../../types/ocpp/OCPPServer';

import BackendError from '../../../exception/BackendError';
import ChargingStation from '../../../types/ChargingStation';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
import fs from 'fs';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'OCPPValidation';

export default class OCPPValidation extends SchemaValidator {
  private static instance: OCPPValidation | null = null;

  private bootNotificationRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/boot-notification-request.json`, 'utf8'));
  private authorizeRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/authorize-request.json`, 'utf8'));
  private statusNotificationRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/status-notification-request.json`, 'utf8'));
  private startTransactionRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/start-transaction-request.json`, 'utf8'));
  private stopTransactionRequest16: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/stop-transaction-request-16.json`, 'utf8'));
  private stopTransactionRequest15: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/stop-transaction-request-15.json`, 'utf8'));

  private constructor() {
    super('OCPPValidation');
  }

  public static getInstance(): OCPPValidation {
    if (!OCPPValidation.instance) {
      OCPPValidation.instance = new OCPPValidation();
    }
    return OCPPValidation.instance;
  }

  public validateHeartbeat(heartbeat: OCPPHeartbeatRequestExtended): void {
  }

  public validateStatusNotification(statusNotification: OCPPStatusNotificationRequestExtended): void {
    // Check non mandatory or wrong timestamp
    if (!statusNotification.timestamp || new Date(statusNotification.timestamp).getFullYear() === new Date(0).getFullYear()) {
      statusNotification.timestamp = new Date().toISOString();
    }
    this.validate(this.statusNotificationRequest, statusNotification);
  }

  public validateAuthorize(authorize: OCPPAuthorizeRequestExtended): void {
    authorize.idTag = this.cleanUpTagID(authorize.idTag);
    this.validate(this.authorizeRequest, authorize);
  }

  public validateBootNotification(bootNotification: OCPPBootNotificationRequestExtended): void {
    this.validate(this.bootNotificationRequest, bootNotification);
  }

  public validateDiagnosticsStatusNotification(chargingStation: ChargingStation,
      diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequestExtended): void {
  }

  public validateFirmwareStatusNotification(chargingStation: ChargingStation,
      firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended): void {
  }

  public validateStartTransaction(chargingStation: ChargingStation, startTransaction: OCPPStartTransactionRequestExtended): void {
    startTransaction.idTag = this.cleanUpTagID(startTransaction.idTag);
    this.validate(this.startTransactionRequest, startTransaction);
    // Check Connector ID
    if (!Utils.getConnectorFromID(chargingStation, startTransaction.connectorId)) {
      throw new BackendError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'validateStartTransaction',
        message: `The Connector ID '${startTransaction.connectorId}' is invalid`,
        action: ServerAction.OCPP_START_TRANSACTION
      });
    }
  }

  public validateDataTransfer(chargingStation: ChargingStation, dataTransfer: OCPPDataTransferRequestExtended): void {
  }

  public validateStopTransaction(chargingStation: ChargingStation, stopTransaction: OCPPStopTransactionRequestExtended): void {
    stopTransaction.idTag = this.cleanUpTagID(stopTransaction.idTag);
    if (chargingStation.ocppVersion === OCPPVersion.VERSION_16) {
      this.validate(this.stopTransactionRequest16, stopTransaction);
    } else {
      this.validate(this.stopTransactionRequest15, stopTransaction);
    }
  }

  public async validateMeterValues(tenantID: string, chargingStation: ChargingStation, meterValues: OCPPMeterValuesRequestExtended): Promise<void> {
    // Always integer
    meterValues.connectorId = Utils.convertToInt(meterValues.connectorId);
    // Check Connector ID
    if (meterValues.connectorId === 0) {
      // KEBA: Connector ID must be > 0 according to OCPP
      await Logging.logWarning({
        tenantID: tenantID,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'validateMeterValues',
        action: ServerAction.OCPP_METER_VALUES,
        message: 'Connector ID must not be \'0\' and has been reset to \'1\''
      });
      // Set to 1 (KEBA has only one connector)
      meterValues.connectorId = 1;
    }
    // Check if the transaction ID matches
    const foundConnector = Utils.getConnectorFromID(chargingStation, meterValues.connectorId);
    if (!foundConnector) {
      await Logging.logWarning({
        tenantID: tenantID,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'validateMeterValues',
        action: ServerAction.OCPP_METER_VALUES,
        message: `Connector ID '${meterValues.connectorId}' not found in charging station for transaction '${meterValues.transactionId}'`
      });
    }
    const connectorTransactionID = Utils.convertToInt(foundConnector ? foundConnector.currentTransactionID : 0);
    // Transaction is provided in MeterValue?
    if (Utils.objectHasProperty(meterValues, 'transactionId')) {
      // Always integer
      meterValues.transactionId = Utils.convertToInt(meterValues.transactionId);
      // Yes: Check Transaction ID (ABB)
      if (meterValues.transactionId !== connectorTransactionID) {
        // Check if valid
        if (connectorTransactionID > 0) {
          // No: Log that the transaction ID will be reused
          await Logging.logWarning({
            tenantID: tenantID,
            ...LoggingHelper.getChargingStationProperties(chargingStation),
            module: MODULE_NAME, method: 'validateMeterValues',
            action: ServerAction.OCPP_METER_VALUES,
            message: `Transaction ID '${meterValues.transactionId}' not found but retrieved from StartTransaction '${connectorTransactionID}'`
          });
        }
        // Always assign, even if equals to 0
        meterValues.transactionId = connectorTransactionID;
      }
    // Transaction is not provided: check if there is a transaction assigned on the connector
    } else if (connectorTransactionID > 0) {
      // Yes: Use Connector's Transaction ID
      await Logging.logWarning({
        tenantID: tenantID,
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'validateMeterValues',
        action: ServerAction.OCPP_METER_VALUES,
        message: `Transaction ID is not provided but retrieved from StartTransaction '${connectorTransactionID}'`
      });
      // Override it
      meterValues.transactionId = connectorTransactionID;
    }
  }

  private cleanUpTagID(tagID: string): string {
    // Handle bug in Tag ID ending with ;NULL on some Charging Stations
    if (tagID && typeof tagID === 'string' && tagID.toLowerCase().endsWith(';null')) {
      tagID = tagID.slice(0, tagID.length - 5);
    }
    return tagID;
  }
}

