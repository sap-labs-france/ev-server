import { ChargePointErrorCode, ChargePointStatus, OCPP15MeterValueRequest, OCPPFirmwareStatus, OCPPLocation, OCPPMeasurand, OCPPMeterValueRequest, OCPPReadingContext, OCPPStatusNotificationRequest, OCPPUnitOfMeasure, OCPPValueFormat } from '../../../src/types/ocpp/OCPPServer';

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
  private transactionsStarted: any;
  private transactionsStopped: any;

  constructor(chargingStation, tenantContext) {
    this.chargingStation = chargingStation;
    this.tenantContext = tenantContext;
    this.transactionsStarted = [];
    this.transactionsStopped = [];
  }

  async initialize(token: string = null) {
    this.ocppService = await this.tenantContext.getOCPPService(this.chargingStation.ocppVersion, token);
  }

  async cleanUpCreatedData() {
    // Clean up transactions
    for (const transaction of this.transactionsStarted) {
      await this.tenantContext.getAdminCentralServerService().transactionApi.delete(transaction.transactionId);
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

  async authorize(tagId: string) {
    const response = await this.ocppService.executeAuthorize(this.chargingStation.id, {
      idTag: tagId
    });
    return response;
  }

  async readChargingStation(userService?: CentralServerService) {
    if (!userService) {
      userService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN));
    }
    return await userService.chargingStationApi.readById(this.chargingStation.id);
  }

  async sendHeartbeat() {
    return await this.ocppService.executeHeartbeat(this.chargingStation.id, {});
  }

  async startTransaction(connectorId: number, tagId: string, meterStart: number, startDate: Date) {
    const response = await this.ocppService.executeStartTransaction(this.chargingStation.id, {
      connectorId: connectorId,
      idTag: tagId,
      meterStart: meterStart,
      timestamp: startDate.toISOString()
    });
    if (response.data) {
      this.addTransactionStarted(response.data);
    }
    return response;
  }

  async stopTransaction(transactionId: number, tagId: string, meterStop: number, stopDate: Date, transactionData?: any) {
    const response = await this.ocppService.executeStopTransaction(this.chargingStation.id, {
      transactionId: transactionId,
      idTag: tagId,
      meterStop: meterStop,
      timestamp: stopDate.toISOString(),
      transactionData: transactionData
    });
    if (response.data) {
      this.addTransactionStopped(response.data);
    }
    return response;
  }

  async sendConsumptionMeterValue(connectorId: number, transactionId: number, meterEnergyValue: number,
    timestamp: Date, withSoC = false, meterSocValue = 0) {
    let meterValueRequest: OCPPMeterValueRequest | OCPP15MeterValueRequest;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === '1.6') {
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
    const response = await this.ocppService.executeMeterValues(this.chargingStation.id, meterValueRequest);
    return response;
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
    signedValue: string, timestamp, withSoC = false, withSignedData = false) {
    let meterValueRequest: OCPPMeterValueRequest | OCPP15MeterValueRequest;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === '1.6') {
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
    }
    // Nothing for OCPP 1.5
    const response = await this.ocppService.executeMeterValues(this.chargingStation.id, meterValueRequest);
    return response;
  }

  async sendClockMeterValue(connectorId: number, transactionId: number, meterValue: number, timestamp: Date) {
    let response;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === '1.6') {
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

  async setConnectorStatus(connector: OCPPStatusNotificationRequest) {
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

  async transferData(data) {
    const response = await this.ocppService.executeDataTransfer(this.chargingStation.id, data);
    return response;
  }

  async sendBootNotification() {
    const response = await this.ocppService.executeBootNotification(
      this.chargingStation.id, {
        chargeBoxSerialNumber: this.chargingStation.chargeBoxSerialNumber,
        chargePointModel: this.chargingStation.chargePointModel,
        chargePointSerialNumber: this.chargingStation.chargePointSerialNumber,
        chargePointVendor: this.chargingStation.chargePointVendor,
        firmwareVersion: this.chargingStation.firmwareVersion
      });
    return response;
  }

  async sendFirmwareStatusNotification(status: OCPPFirmwareStatus) {
    const response = await this.ocppService.executeFirmwareStatusNotification(
      this.chargingStation.id, { status: status }
    );
    return response;
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
