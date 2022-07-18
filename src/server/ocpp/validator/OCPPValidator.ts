import { OCPPAuthorizeRequestExtended, OCPPBootNotificationRequestExtended, OCPPDataTransferRequestExtended, OCPPDiagnosticsStatusNotificationRequestExtended, OCPPFirmwareStatusNotificationRequestExtended, OCPPHeartbeatRequestExtended, OCPPMeterValuesRequestExtended, OCPPStartTransactionRequestExtended, OCPPStatusNotificationRequestExtended, OCPPStopTransactionRequestExtended, OCPPVersion } from '../../../types/ocpp/OCPPServer';

import BackendError from '../../../exception/BackendError';
import ChargingStation from '../../../types/ChargingStation';
import Logging from '../../../utils/Logging';
import LoggingHelper from '../../../utils/LoggingHelper';
import { OCPPHeader } from '../../../types/ocpp/OCPPHeader';
import Schema from '../../../types/validator/Schema';
import SchemaValidator from '../../../validator/SchemaValidator';
import { ServerAction } from '../../../types/Server';
import Utils from '../../../utils/Utils';
import fs from 'fs';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'OCPPValidator';

export default class OCPPValidator extends SchemaValidator {
  private static instance: OCPPValidator | null = null;

  private bootNotificationRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/boot-notification-request.json`, 'utf8'));
  private authorizeRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/authorize-request.json`, 'utf8'));
  private statusNotificationRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/status-notification-request.json`, 'utf8'));
  private startTransactionRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/start-transaction-request.json`, 'utf8'));
  private stopTransactionRequest16: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/stop-transaction-request-16.json`, 'utf8'));
  private stopTransactionRequest15: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/stop-transaction-request-15.json`, 'utf8'));
  private diagnosticsStatusNotificationRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/diagnostics-status-notification-request.json`, 'utf8'));
  private heartbeatRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/heartbeat-request.json`, 'utf8'));
  private firmwareStatusNotificationRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/firmware-status-notification-request.json`, 'utf8'));
  private dataTransferRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/data-transfert-request.json`, 'utf8'));
  private meterValueRequest: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/ocpp/schemas/meter-values-request.json`, 'utf8'));

  private constructor() {
    super('OCPPValidator');
  }

  public static getInstance(): OCPPValidator {
    if (!OCPPValidator.instance) {
      OCPPValidator.instance = new OCPPValidator();
    }
    return OCPPValidator.instance;
  }

  public validateHeartbeat(heartbeat: OCPPHeartbeatRequestExtended): void {
    this.validate(this.heartbeatRequest, heartbeat);
  }

  public validateStatusNotification(statusNotification: OCPPStatusNotificationRequestExtended): void {
    this.validate(this.statusNotificationRequest, statusNotification);
    // Check non mandatory or wrong timestamp
    if (!statusNotification.timestamp || new Date(statusNotification.timestamp).getFullYear() === new Date(0).getFullYear()) {
      statusNotification.timestamp = new Date().toISOString();
    }
  }

  public validateAuthorize(authorize: OCPPAuthorizeRequestExtended): void {
    authorize.idTag = this.cleanUpTagID(authorize.idTag);
    this.validate(this.authorizeRequest, authorize);
  }

  public validateBootNotification(headers: OCPPHeader, bootNotification: OCPPBootNotificationRequestExtended): void {
    this.validate(this.bootNotificationRequest, bootNotification);
    // Check Charging Station
    if (!headers.chargeBoxIdentity) {
      throw new BackendError({
        action: ServerAction.OCPP_BOOT_NOTIFICATION,
        module: MODULE_NAME, method: 'validateBootNotification',
        message: 'Should have the required property \'chargeBoxIdentity\'!',
        detailedMessages: { headers, bootNotification }
      });
    }
  }

  public validateDiagnosticsStatusNotification(diagnosticsStatusNotification: OCPPDiagnosticsStatusNotificationRequestExtended): void {
    this.validate(this.diagnosticsStatusNotificationRequest, diagnosticsStatusNotification);
  }

  public validateFirmwareStatusNotification(chargingStation: ChargingStation,
      firmwareStatusNotification: OCPPFirmwareStatusNotificationRequestExtended): void {
    this.validate(this.firmwareStatusNotificationRequest, firmwareStatusNotification);
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
    this.validate(this.dataTransferRequest, dataTransfer);
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
    this.validate(this.meterValueRequest, meterValues);
    // Check Connector ID
    if (meterValues.connectorId === 0) {
      // KEBA: Connector ID must be > 0 according to OCPP
      await Logging.logWarning({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenantID,
        module: MODULE_NAME, method: 'validateMeterValues',
        action: ServerAction.OCPP_METER_VALUES,
        message: 'Connector ID must not be \'0\' and has been reset to \'1\''
      });
      // Set to 1 (KEBA has only one connector)
      meterValues.connectorId = 1;
    }
    // Check if the transaction ID matches with the one on the Connector
    const foundConnector = Utils.getConnectorFromID(chargingStation, meterValues.connectorId);
    if (!foundConnector) {
      await Logging.logWarning({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        tenantID: tenantID,
        module: MODULE_NAME, method: 'validateMeterValues',
        action: ServerAction.OCPP_METER_VALUES,
        message: `Connector ID '${meterValues.connectorId}' not found for Transaction ID '${meterValues.transactionId}'`
      });
      return;
    }
    // Transaction ID is provided on Connector
    if (foundConnector?.currentTransactionID > 0) {
      // Check if provided in Meter Values
      if (meterValues.transactionId === 0 && foundConnector.currentTransactionID > 0) {
        // Reuse Transaction ID from Connector
        meterValues.transactionId = foundConnector.currentTransactionID;
        await Logging.logWarning({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          tenantID: tenantID,
          module: MODULE_NAME, method: 'validateMeterValues',
          action: ServerAction.OCPP_METER_VALUES,
          message: `Transaction ID '${meterValues.transactionId}' not found in Meter Values but retrieved from Connector ID '${foundConnector.connectorId}'`
        });
      }
    }
  }

  private cleanUpTagID(tagID: string): string {
    // Handle Tag ID containing ';' usually sent by Charging Station's payment terminals
    if (tagID &&
        typeof tagID === 'string' &&
        tagID.toLowerCase().includes(';')) {
      tagID = tagID.split(';')[1];
    }
    return tagID;
  }
}

