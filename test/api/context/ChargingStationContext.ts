import { ChargePointErrorCode, ChargePointStatus, OCPP15MeterValuesRequest, OCPP15TransactionData, OCPPAuthorizeResponse, OCPPBootNotificationResponse, OCPPDataTransferResponse, OCPPFirmwareStatus, OCPPFirmwareStatusNotificationResponse, OCPPHeartbeatResponse, OCPPLocation, OCPPMeasurand, OCPPMeterValue, OCPPMeterValuesRequest, OCPPMeterValuesResponse, OCPPReadingContext, OCPPStartTransactionResponse, OCPPStatusNotificationRequest, OCPPStatusNotificationResponse, OCPPStopTransactionResponse, OCPPUnitOfMeasure, OCPPValueFormat, OCPPVersion } from '../../../src/types/ocpp/OCPPServer';

import CentralServerService from '../client/CentralServerService';
import ChargingStation from '../../types/ChargingStation';
import ContextDefinition from './ContextDefinition';
import OCPPService from '../ocpp/OCPPService';
import TenantContext from './TenantContext';
import Utils from '../../../src/utils/Utils';
import faker from 'faker';

export default class ChargingStationContext {

  private chargingStation: ChargingStation;
  private ocppService: OCPPService;
  private tenantContext: TenantContext;
  private transactionsStarted: OCPPStartTransactionResponse[] = [];
  private transactionsStopped: OCPPStopTransactionResponse[] = [];

  constructor(chargingStation, tenantContext) {
    this.chargingStation = chargingStation;
    this.tenantContext = tenantContext;
  }

  async initialize(token: string = null) {
    this.ocppService = await this.tenantContext.getOCPPService(this.chargingStation.ocppVersion, token);
  }

  async cleanUpCreatedData() {
    // Clean up transactions
    for (const transaction of this.transactionsStarted) {
      if (transaction.transactionId) {
        const transactionResponse = await this.tenantContext.getAdminCentralServerService().transactionApi.readById(transaction.transactionId);
        if (transactionResponse.status === 200) {
          await this.tenantContext.getAdminCentralServerService().transactionApi.delete(transaction.transactionId);
        }
      }
    }
  }

  getChargingStation() {
    return this.chargingStation;
  }

  addTransactionStarted(transaction) {
    this.transactionsStarted.push(transaction);
  }

  addTransactionStopped(transaction) {
    this.transactionsStopped.push(transaction);
  }

  async authorize(tagId: string): Promise<OCPPAuthorizeResponse> {
    return this.ocppService.executeAuthorize(this.chargingStation.id, {
      idTag: tagId
    });
  }

  async readChargingStation(userService?: CentralServerService) {
    if (!userService) {
      userService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN));
    }
    return await userService.chargingStationApi.readById(this.chargingStation.id);
  }

  async sendHeartbeat(): Promise<OCPPHeartbeatResponse> {
    return await this.ocppService.executeHeartbeat(this.chargingStation.id, {});
  }

  async startTransaction(connectorId: number, tagId: string, meterStart: number, startDate: Date): Promise<OCPPStartTransactionResponse> {
    const response = await this.ocppService.executeStartTransaction(this.chargingStation.id, {
      connectorId: connectorId,
      idTag: tagId,
      meterStart: meterStart,
      timestamp: startDate.toISOString()
    });
    if (response) {
      this.addTransactionStarted(response);
    }
    return response;
  }

  async stopTransaction(transactionId: number, tagId: string, meterStop: number, stopDate: Date, transactionData?: OCPPMeterValue[] | OCPP15TransactionData): Promise<OCPPStopTransactionResponse> {
    // Check props
    const response = await this.ocppService.executeStopTransaction(this.chargingStation.id, {
      transactionId: transactionId,
      idTag: tagId,
      meterStop: meterStop,
      timestamp: stopDate.toISOString(),
      transactionData: transactionData
    });
    if (response) {
      this.addTransactionStopped(response);
    }
    return response;
  }

  public removeTransaction(transactionId: number) {
    for (let i = 0; i < this.transactionsStarted.length; i++) {
      const transaction = this.transactionsStarted[i];
      if (transaction.transactionId === transactionId) {
        this.transactionsStarted.splice(i, 1);
        break;
      }
    }
  }

  async sendConsumptionMeterValue(connectorId: number, transactionId: number, meterEnergyValue: number,
    timestamp: Date, withSoC = false, meterSocValue = 0): Promise<OCPPMeterValuesResponse> {
    let meterValueRequest: OCPPMeterValuesRequest | OCPP15MeterValuesRequest;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === OCPPVersion.VERSION_16) {
      // Energy
      meterValueRequest = {
        connectorId: connectorId,
        transactionId: transactionId,
        meterValue: [{
          timestamp: timestamp.toISOString(),
          sampledValue: [{
            value: meterEnergyValue.toString(),
            format: OCPPValueFormat.RAW,
            measurand: OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER,
            unit: OCPPUnitOfMeasure.WATT_HOUR,
            location: OCPPLocation.OUTLET,
            context: OCPPReadingContext.SAMPLE_PERIODIC
          }]
        }],
      };
      // Soc
      if (withSoC) {
        meterValueRequest.meterValue[0].sampledValue.push({
          value: meterSocValue.toString(),
          unit: OCPPUnitOfMeasure.PERCENT,
          context: OCPPReadingContext.SAMPLE_PERIODIC,
          measurand: OCPPMeasurand.STATE_OF_CHARGE,
          location: OCPPLocation.EV
        });
      }
    // OCPP 1.5 (only without SoC)
    } else {
      // Energy
      meterValueRequest = {
        connectorId: connectorId,
        transactionId: transactionId,
        values: {
          timestamp: timestamp.toISOString(),
          value: {
            $attributes: {
              unit: OCPPUnitOfMeasure.WATT_HOUR,
              location: OCPPLocation.OUTLET,
              measurand: OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER,
              format: OCPPValueFormat.RAW,
              context: OCPPReadingContext.SAMPLE_PERIODIC
            },
            $value: meterEnergyValue.toString()
          }
        },
      };
    }
    // Execute
    return this.ocppService.executeMeterValues(this.chargingStation.id, meterValueRequest);
  }

  async sendBeginMeterValue(connectorId: number, transactionId: number, meterEnergyValue: number, meterSocValue: number,
    signedValue: string, timestamp, withSoC = false, withSignedData = false) {
    return this.sendBeginEndMeterValue(OCPPReadingContext.TRANSACTION_BEGIN, connectorId, transactionId, meterEnergyValue,
      meterSocValue, signedValue, timestamp, withSoC, withSignedData);
  }

  async sendEndMeterValue(connectorId: number, transactionId: number, meterEnergyValue: number, meterSocValue: number,
    signedValue: string, timestamp, withSoC = false, withSignedData = false) {
    return this.sendBeginEndMeterValue(OCPPReadingContext.TRANSACTION_END, connectorId, transactionId, meterEnergyValue,
      meterSocValue, signedValue, timestamp, withSoC, withSignedData);
  }

  async sendBeginEndMeterValue(context: OCPPReadingContext.TRANSACTION_BEGIN | OCPPReadingContext.TRANSACTION_END,
    connectorId: number, transactionId: number, meterEnergyValue: number, meterSocValue: number,
    signedValue: string, timestamp, withSoC = false, withSignedData = false): Promise<OCPPMeterValuesResponse> {
    let meterValueRequest: OCPPMeterValuesRequest | OCPP15MeterValuesRequest;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === OCPPVersion.VERSION_16) {
      // Energy
      meterValueRequest = {
        connectorId: connectorId,
        transactionId: transactionId,
        meterValue: [{
          timestamp: timestamp.toISOString(),
          sampledValue: [{
            value: meterEnergyValue.toString(),
            unit: OCPPUnitOfMeasure.WATT_HOUR,
            context: context
          }]
        }],
      };
      // Soc
      if (withSoC) {
        meterValueRequest.meterValue[0].sampledValue.push({
          value: meterSocValue.toString(),
          unit: OCPPUnitOfMeasure.PERCENT,
          context: context,
          measurand: OCPPMeasurand.STATE_OF_CHARGE,
          location: OCPPLocation.EV
        });
      }
      // Signed Data
      if (withSignedData) {
        meterValueRequest.meterValue[0].sampledValue.push({
          value: signedValue,
          format: OCPPValueFormat.SIGNED_DATA,
          context: context,
        });
      }
    // OCPP 1.5
    } else if (this.chargingStation.ocppVersion === OCPPVersion.VERSION_15) {
      // Do Nothing
    }
    return this.ocppService.executeMeterValues(this.chargingStation.id, meterValueRequest);
  }

  async sendClockMeterValue(connectorId: number, transactionId: number, meterValue: number, timestamp: Date): Promise<OCPPMeterValuesResponse> {
    let response: OCPPMeterValuesResponse;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === OCPPVersion.VERSION_16) {
      response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
        connectorId: connectorId,
        transactionId: transactionId,
        meterValue: [{
          timestamp: timestamp.toISOString(),
          sampledValue: [{
            value: meterValue.toString(),
            format: OCPPValueFormat.RAW,
            measurand: OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER,
            unit: OCPPUnitOfMeasure.WATT_HOUR,
            location: OCPPLocation.OUTLET,
            context: OCPPReadingContext.SAMPLE_CLOCK
          }]
        }],
      });
      // OCPP 1.5
    } else {
      response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
        connectorId: connectorId,
        transactionId: transactionId,
        values: {
          timestamp: timestamp.toISOString(),
          value: {
            $attributes: {
              unit: OCPPUnitOfMeasure.WATT_HOUR,
              location: OCPPLocation.OUTLET,
              measurand: OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER,
              format: OCPPValueFormat.RAW,
              context: OCPPReadingContext.SAMPLE_CLOCK
            },
            $value: meterValue.toString()
          }
        },
      });
    }
    return response;
  }

  async setConnectorStatus(connector: OCPPStatusNotificationRequest): Promise<OCPPStatusNotificationResponse> {
    if (!Utils.objectHasProperty(connector, 'connectorId')) {
      connector.connectorId = 1;
    }
    if (!Utils.objectHasProperty(connector, 'status')) {
      connector.status = ChargePointStatus.AVAILABLE;
    }
    if (!Utils.objectHasProperty(connector, 'errorCode')) {
      connector.errorCode = ChargePointErrorCode.NO_ERROR;
    }
    if (!Utils.objectHasProperty(connector, 'timestamp')) {
      connector.timestamp = new Date().toISOString();
    }
    const response = await this.ocppService.executeStatusNotification(this.chargingStation.id, connector);
    this.chargingStation.connectors[connector.connectorId - 1].status = connector.status;
    this.chargingStation.connectors[connector.connectorId - 1].errorCode = connector.errorCode;
    return response;
  }

  async transferData(data): Promise<OCPPDataTransferResponse> {
    return this.ocppService.executeDataTransfer(this.chargingStation.id, data);
  }

  async sendBootNotification(): Promise<OCPPBootNotificationResponse> {
    return this.ocppService.executeBootNotification(
      this.chargingStation.id, {
        chargeBoxSerialNumber: this.chargingStation.chargeBoxSerialNumber,
        chargePointModel: this.chargingStation.chargePointModel,
        chargePointSerialNumber: this.chargingStation.chargePointSerialNumber,
        chargePointVendor: this.chargingStation.chargePointVendor,
        firmwareVersion: this.chargingStation.firmwareVersion
      }
    );
  }

  async sendFirmwareStatusNotification(status: OCPPFirmwareStatus): Promise<OCPPFirmwareStatusNotificationResponse> {
    return this.ocppService.executeFirmwareStatusNotification(
      this.chargingStation.id, { status: status }
    );
  }

  getConfiguration() {
    const configuration: any = {
      'stationTemplate': {
        'baseName': 'CS-' + faker.random.alphaNumeric(10),
        'chargePointModel': this.chargingStation.chargePointModel,
        'chargePointVendor': this.chargingStation.chargePointVendor,
        'power': [7200, 16500, 22000, 50000],
        'powerUnit': 'W',
        'numberOfConnectors': this.chargingStation.connectors.length,
        'randomConnectors': false,
        'Configuration': {
          'NumberOfConnectors': this.chargingStation.connectors.length,
          'param1': 'test',
          'meterValueInterval': 60
        },
        'AutomaticTransactionGenerator': {
          'enable': true,
          'minDuration': 70,
          'maxDuration': 180,
          'minDelayBetweenTwoTransaction': 30,
          'maxDelayBetweenTwoTransaction': 60,
          'probabilityOfStart': 1,
          'stopAutomaticTransactionGeneratorAfterHours': 0.3
        },
        'Connectors': {}
      }
    };
    this.chargingStation.connectors.forEach((connector) => {
      configuration.Connectors[connector.connectorId] = {
        'MeterValues': [{
          'unit': 'Percent',
          'context': 'Sample.Periodic',
          'measurand': 'SoC',
          'location': 'EV'
        }, {
          'unit': 'Wh',
          'context': 'Sample.Periodic'
        }]
      };
    });
    return configuration;
  }
}
