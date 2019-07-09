import faker from 'faker';
import TenantContext from './TenantContext';
import Utils from '../../../src/utils/Utils';

export default class ChargingStationContext {

  private chargingStation: any;
  private tenantContext: TenantContext;
  private transactionsStarted: any;
  private transactionsStopped: any;

  constructor(chargingStation, tenantContext) {
    this.chargingStation = chargingStation;
    this.tenantContext = tenantContext;
    this.transactionsStarted = [];
    this.transactionsStopped = [];
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

  async authorize(tagId) {
    const response = await this.tenantContext.getOCPPService(this.chargingStation.ocppVersion).executeAuthorize(this.chargingStation.id, {
      idTag: tagId
    });
    return response;
  }

  async startTransaction(connectorId, tagId, meterStart, startDate) {
    const response = await this.tenantContext.getOCPPService(this.chargingStation.ocppVersion).executeStartTransaction(this.chargingStation.id, {
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

  async stopTransaction(transactionId, tagId, meterStop, stopDate) {
    const response = await this.tenantContext.getOCPPService(this.chargingStation.ocppVersion).executeStopTransaction(this.chargingStation.id, {
      transactionId: transactionId,
      idTag: tagId,
      meterStop: meterStop,
      timestamp: stopDate.toISOString()
    });
    if (response.data) {
      this.addTransactionStopped(response.data);
    }
    return response;
  }


  async sendConsumptionMeterValue(connectorId, transactionId, meterValue, timestamp) {
    const response = await this.tenantContext.getOCPPService(this.chargingStation.ocppVersion).executeMeterValues(this.chargingStation.id, {
      connectorId: connectorId,
      transactionId: transactionId,
      meterValue: {
        timestamp: timestamp.toISOString(),
        sampledValue: [{ // For OCPP 1.6
          value: meterValue,
          format: 'Raw',
          measurand: 'Energy.Active.Import.Register',
          unit: 'Wh',
          location: 'Outlet',
          context: 'Sample.Periodic'
        }]
      },
      values: { // For OCPP 1.5
        timestamp: timestamp.toISOString(),
        value: {
          $attributes: {
            unit: 'Wh',
            location: 'Outlet',
            measurand: 'Energy.Active.Import.Register',
            format: 'Raw',
            context: 'Sample.Periodic'
          },
          $value: meterValue
        }
      },
    });
    return response;
  }

  async sendSoCMeterValue(connectorId, transactionId, meterValue, timestamp) {
    const response = await this.tenantContext.getOCPPService(this.chargingStation.ocppVersion).executeMeterValues(this.chargingStation.id, {
      connectorId: connectorId,
      transactionId: transactionId,
      meterValue: {
        timestamp: timestamp.toISOString(),
        sampledValue: [{
          value: meterValue,
          format: 'Raw',
          measurand: 'SoC',
          context: 'Sample.Periodic'
        }]

      },
    });
    return response;
  }

  async sendClockMeterValue(connectorId, transactionId, meterValue, timestamp) {
    const response = await this.tenantContext.getOCPPService(this.chargingStation.ocppVersion).executeMeterValues(this.chargingStation.id, {
      connectorId: connectorId,
      transactionId: transactionId,
      meterValue: {
        timestamp: timestamp.toISOString(),
        sampledValue: [{
          value: meterValue,
          format: 'Raw',
          measurand: 'Energy.Active.Import.Register',
          unit: 'Wh',
          location: 'Outlet',
          context: 'Sample.Clock'
        }]

      },
    });
    return response;
  }

  async setConnectorStatus(connectorId, status, timestamp) {
    const connector = Utils.duplicateJSON(this.chargingStation.connectors[connectorId]);
    connector.status = status;
    connector.timestamp = timestamp.toISOString();
    const response = await this.tenantContext.getOCPPService(this.chargingStation.ocppVersion).executeStatusNotification(this.chargingStation.id, connector);
    this.chargingStation.connectors[connectorId].status = connector.status;
    this.chargingStation.connectors[connectorId].timestamp = connector.timestamp;
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
