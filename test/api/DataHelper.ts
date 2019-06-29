import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import config from '../config';
import faker from 'faker';
import { from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import CentralServerService from './client/CentralServerService';
import Factory from '../factories/Factory';
import OCPPJsonService16 from './ocpp/json/OCPPJsonService16';
// pragma import OCPPService from './ocpp/OCPPService';
import OCPPSoapService15 from './ocpp/soap/OCPPSoapService15';
import Utils from '../../src/utils/Utils';

chai.use(chaiSubset);

export default class DataHelper {
  private ocpp: any;
  private centralServerService: CentralServerService;
  private context: any;

  public constructor(ocppVersion, tenantID, ocppRequestHandler = null) {
    if (ocppVersion === '1.6') {
      this.ocpp = new OCPPJsonService16(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP16/${tenantID}`, ocppRequestHandler);
    } else if (ocppVersion === '1.5') {
      this.ocpp = new OCPPSoapService15(`${config.get('ocpp.soap.scheme')}://${config.get('ocpp.soap.host')}:${config.get('ocpp.soap.port')}/OCPP15?TenantID=${tenantID}`);
    } else {
      throw new Error('unknown ocpp version');
    }

    this.centralServerService = new CentralServerService();

    this.context = {
      chargingStations: [],
      siteAreas: [],
      sites: [],
      companies: [],
      users: []
    };
  }

  public async createUser(user = Factory.user.build()) {
    const createdUser = await this.centralServerService.createEntity(this.centralServerService.userApi, user);
    this.context.users.push(createdUser);
    return createdUser;
  }

  public async createCompany(company = Factory.company.build()) {
    const createdCompany = await this.centralServerService.createEntity(this.centralServerService.companyApi, company);
    this.context.companies.push(createdCompany);
    return createdCompany;
  }

  public async createSite(company, users, site = Factory.site.build({
    companyID: company.id,
    userIDs: users.map((user) => {
      return user.id;
    })
  })) {
    const createdSite = await this.centralServerService.createEntity(this.centralServerService.siteApi, site);
    this.context.sites.push(createdSite);
    return createdSite;
  }

  public async createSiteArea(site, chargingStations, siteArea = Factory.siteArea.build({
    siteID: site.id,
    chargeBoxIDs: chargingStations.map((chargingStation) => {
      return chargingStation.id;
    })
  })) {
    const createdSiteArea = await this.centralServerService.createEntity(this.centralServerService.siteAreaApi, siteArea);
    this.context.siteAreas.push(createdSiteArea);
    return createdSiteArea;
  }

  public async getChargingStation(chargingStation, withCheck = true) {
    return await this.centralServerService.getEntityById(this.centralServerService.chargingStationApi, chargingStation, withCheck);
  }

  public async createChargingStation(chargingStation = Factory.chargingStation.build({ id: faker.random.alphaNumeric(12) }), numberOfConnectors = 2) {
    await this.sendBootNotification(chargingStation);
    const createdChargingStation = await this.getChargingStation(chargingStation);
    chargingStation.connectors = [];
    for (let i = 0; i < numberOfConnectors; i++) {
      createdChargingStation.connectors[i] = {
        connectorId: i + 1,
        status: 'Available',
        errorCode: 'NoError',
        timestamp: new Date().toISOString()
      };
    }
    for (const connector of createdChargingStation.connectors) {
      const response = await this.ocpp.executeStatusNotification(createdChargingStation.id, connector);
      expect(response).to.not.be.null;
      expect(response.data).to.be.empty;
    }

    this.context.chargingStations.push(createdChargingStation);
    return createdChargingStation;
  }

  public async destroyData() {
    await this.executeOnAll(this.context.users, (user) => {
      return this.centralServerService.deleteEntity(
        this.centralServerService.userApi, user);
    });
    this.context.siteAreas.forEach((siteArea) => {
      return this.centralServerService.deleteEntity(
        this.centralServerService.siteAreaApi, siteArea);
    });
    this.context.sites.forEach((site) => {
      return this.centralServerService.deleteEntity(
        this.centralServerService.siteApi, site);
    });
    this.context.companies.forEach((company) => {
      return this.centralServerService.deleteEntity(
        this.centralServerService.companyApi, company);
    });
    this.context.chargingStations.forEach((chargingStation) => {
      return this.centralServerService.deleteEntity(
        this.centralServerService.chargingStationApi, chargingStation);
    });
  }

  public async executeOnAll(array, method) {
    await from(array).pipe(
      mergeMap(method, 50)
    ).toPromise();
  }

  public async close() {
    if (this.ocpp && this.ocpp.closeConnection) {
      this.ocpp.closeConnection();
    }
  }

  public async authorize(chargingStation, tagId, expectedStatus = 'Accepted') {
    const response = await this.ocpp.executeAuthorize(chargingStation.id, {
      idTag: tagId
    });
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal(expectedStatus);
    return response.data;
  }

  public async sendBootNotification(chargingStation, expectedStatus = 'Accepted') {
    const response = await this.ocpp.executeBootNotification(
      chargingStation.id, {
        chargeBoxSerialNumber: chargingStation.chargeBoxSerialNumber,
        chargePointModel: chargingStation.chargePointModel,
        chargePointSerialNumber: chargingStation.chargePointSerialNumber,
        chargePointVendor: chargingStation.chargePointVendor,
        firmwareVersion: chargingStation.firmwareVersion
      });
    expect(response.data).to.not.be.null;
    expect(response.data.status).to.eql(expectedStatus);
    expect(response.data).to.have.property('currentTime');

    return response.data;
  }

  public async startTransaction(chargingStation, connectorId, tagId, meterStart, startDate, expectedStatus = 'Accepted') {
    const response = await this.ocpp.executeStartTransaction(chargingStation.id, {
      connectorId: connectorId,
      idTag: tagId,
      meterStart: meterStart,
      timestamp: startDate.toISOString()
    });
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal(expectedStatus);
    expect(response.data).to.have.property('transactionId');
    if (expectedStatus === 'Accepted') {
      expect(response.data.transactionId).to.not.equal(0);
    } else {
      expect(response.data.transactionId).to.equal(0);
    }
    return response.data.transactionId;
  }

  public async stopTransaction(chargingStation, transactionId, tagId, meterStop, stopDate, transactionData, expectedStatus = 'Accepted') {
    const response = await this.ocpp.executeStopTransaction(chargingStation.id, {
      transactionId: transactionId,
      idTag: tagId,
      meterStop: meterStop,
      timestamp: stopDate.toISOString(),
      transactionData: transactionData
    });
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal(expectedStatus);
  }


  public async sendConsumptionMeterValue(chargingStation, connectorId, transactionId, meterValue, timestamp) {
    let response;
    // OCPP 1.6?
    if (this.ocpp.getVersion() === '1.6') {
      response = await this.ocpp.executeMeterValues(chargingStation.id, {
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
    // OCPP 1.5
    } else {
      response = await this.ocpp.executeMeterValues(chargingStation.id, {
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
    expect(response.data).to.eql({});
  }

  public async sendSoCMeterValue(chargingStation, connectorId, transactionId, meterValue, timestamp) {
    const response = await this.ocpp.executeMeterValues(chargingStation.id, {
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
    expect(response.data).to.eql({});
  }

  public async sendClockMeterValue(chargingStation, connectorId, transactionId, meterValue, timestamp) {
    let response;
    // OCPP 1.6?
    if (this.ocpp.getVersion() === '1.6') {
      const response = await this.ocpp.executeMeterValues(chargingStation.id, {
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
      response = await this.ocpp.executeMeterValues(chargingStation.id, {
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
    expect(response.data).to.eql({});
  }

  public async setConnectorStatus(ocpp, chargingStation, connectorId, status, timestamp) {
    const connector = Utils.duplicateJSON(chargingStation.connectors[connectorId]);
    connector.status = status;
    connector.timestamp = timestamp.toISOString();
    const response = await ocpp.executeStatusNotification(chargingStation.id, connector);
    expect(response.data).to.eql({});
    chargingStation.connectors[connectorId].status = connector.status;
    chargingStation.connectors[connectorId].timestamp = connector.timestamp;
  }

  public getConfigurationOf(chargingStation) {
    const configuration = {
      'stationTemplate': {
        'baseName': 'CS-' + faker.random.alphaNumeric(10),
        'chargePointModel': chargingStation.chargePointModel,
        'chargePointVendor': chargingStation.chargePointVendor,
        'power': [7200, 16500, 22000, 50000],
        'powerUnit': 'W',
        'numberOfConnectors': chargingStation.connectors.length,
        'randomConnectors': false,
        'Configuration': {
          'NumberOfConnectors': chargingStation.connectors.length,
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
    chargingStation.connectors.forEach((connector) => {
      configuration['Connectors'][connector.connectorId] = {
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
