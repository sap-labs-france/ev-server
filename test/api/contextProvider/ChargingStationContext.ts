import faker from 'faker';
import CentralServerService from '../client/CentralServerService';
import CONTEXTS from '../contextProvider/ContextConstants';
import TenantContext from './TenantContext';
import ChargingStation from '../../types/ChargingStation';
import OCPPService from '../ocpp/OCPPService';

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

  async authorize(tagId) {
    const response = await this.ocppService.executeAuthorize(this.chargingStation.id, {
      idTag: tagId
    });
    return response;
  }

  async isAuthorized(userService: CentralServerService) {
    return await userService.chargingStationApi.isAuthorized('ConnectorsAction', this.chargingStation.id);
  }

  async isAuthorizedToStopTransaction(userService: CentralServerService, transactionId: string) {
    return await userService.chargingStationApi.isAuthorized('StopTransaction', this.chargingStation.id, transactionId);
  }

  async readChargingStation(userService?: CentralServerService) {
    if (!userService) {
      userService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN));
    }
    return await userService.chargingStationApi.readById(this.chargingStation.id);
  }

  async sendHeartbeat() {
    return await this.ocppService.executeHeartbeat(this.chargingStation.id, {});
  }

  async startTransaction(connectorId, tagId, meterStart, startDate) {
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

  async stopTransaction(transactionId, tagId, meterStop, stopDate, transactionData?) {
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

  async sendConsumptionMeterValue(connectorId, transactionId, meterValue, timestamp, withSoC = false, meterSocValue?) {
    let response;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === '1.6') {
      // Yes
      if (withSoC) {
        // With State of Charge ?
        response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: {
            timestamp: timestamp.toISOString(),
            sampledValue: [{
              value: meterValue,
              unit: 'Wh',
              context: 'Sample.Periodic'
            }, {
              value: meterSocValue,
              unit: 'Percent',
              context: 'Sample.Periodic',
              measurand: 'SoC',
              location: 'EV'
            }]
          },
        });
      } else {
        // Regular case
        response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
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
              context: 'Sample.Periodic'
            }]
          },
        });
      }
      // OCPP 1.5 (only without SoC)
    } else {
      response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
        connectorId: connectorId,
        transactionId: transactionId,
        values: {
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
    }
    return response;
  }

  async sendBeginMeterValue(connectorId, transactionId, meterValue, meterSocValue, signedValue, timestamp, withSoC = false, withSignedData = false) {
    let response;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === '1.6') {
      // Yes
      if (withSoC) {
        // With State of Charge ?
        response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: {
            timestamp: timestamp.toISOString(),
            sampledValue: [{
              value: meterValue,
              unit: 'Wh',
              context: 'Transaction.Begin'
            }, {
              value: meterSocValue,
              unit: 'Percent',
              context: 'Transaction.Begin',
              measurand: 'SoC',
              location: 'EV'
            }]
          },
        });
      } else if (withSignedData) {
        // With SignedData ?
        response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: {
            timestamp: timestamp.toISOString(),
            sampledValue: [{
              value: signedValue,
              unit: 'Wh',
              context: 'Transaction.Begin',
              format: 'SignedData'
            }, {
              value: meterValue,
              unit: 'Wh',
              context: 'Transaction.Begin'
            }]
          },
        });
      } else {
        // Regular case
        response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: {
            timestamp: timestamp.toISOString(),
            sampledValue: [{
              value: meterValue,
              unit: 'Wh',
              context: 'Transaction.Begin'
            }]
          },
        });
      }
    } // Nothing for OCPP 1.5
    return response;
  }

  async sendEndMeterValue(connectorId, transactionId, meterValue, meterSocValue, signedValue, timestamp, withSoC = false, withSignedData = false) {
    let response;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === '1.6') {
      // Yes
      if (withSoC) {
        // With State of Charge ?
        response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: {
            timestamp: timestamp.toISOString(),
            sampledValue: [{
              value: meterValue,
              unit: 'Wh',
              context: 'Transaction.End'
            }, {
              value: meterSocValue,
              unit: 'Percent',
              context: 'Transaction.End',
              measurand: 'SoC',
              location: 'EV'
            }]
          },
        });
      } else if (withSignedData) {
        // With SignedData ?
        response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: {
            timestamp: timestamp.toISOString(),
            sampledValue: [{
              value: signedValue,
              unit: 'Wh',
              context: 'Transaction.End',
              format: 'SignedData'
            }, {
              value: meterValue,
              unit: 'Wh',
              context: 'Transaction.End'
            }]
          },
        });
      } else {
        // Regular case
        response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: {
            timestamp: timestamp.toISOString(),
            sampledValue: [{
              value: meterValue,
              unit: 'Wh',
              context: 'Transaction.End'
            }]
          },
        });
      }
    } // Nothing for OCPP 1.5
    return response;
  }

  async sendSoCMeterValue(connectorId, transactionId, meterValue, timestamp) {
    const response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
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
    let response;
    // OCPP 1.6?
    if (this.chargingStation.ocppVersion === '1.6') {
      response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
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
      // OCPP 1.5
    } else {
      response = await this.ocppService.executeMeterValues(this.chargingStation.id, {
        connectorId: connectorId,
        transactionId: transactionId,
        values: {
          timestamp: timestamp.toISOString(),
          value: {
            $attributes: {
              unit: 'Wh',
              location: 'Outlet',
              measurand: 'Energy.Active.Import.Register',
              format: 'Raw',
              context: 'Sample.Clock'
            },
            $value: meterValue
          }
        },
      });
    }
    return response;
  }

  async setConnectorStatus(connector) {
    if (!('connectorId' in connector)) {
      connector.connectorId = 1;
    }
    if (!('status' in connector)) {
      connector.status = 'Available';
    }
    if (!('errorCode' in connector)) {
      connector.errorCode = 'NoError';
    }
    if (!('timestamp' in connector)) {
      connector.timestamp = new Date().toISOString;
    }
    const response = await this.ocppService.executeStatusNotification(this.chargingStation.id, connector);
    this.chargingStation.connectors[connector.connectorId - 1].status = connector.status;
    this.chargingStation.connectors[connector.connectorId - 1].errorCode = connector.errorCode;
    this.chargingStation.connectors[connector.connectorId - 1].timestamp = connector.timestamp;
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
