const {
  expect
} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const Factory = require('../../factories/Factory');
const config = require('../../config');
const OCPPJsonService16 = require('../ocpp/json/OCPPJsonService16');
const OCPPJsonService15 = require('../ocpp/soap/OCPPSoapService15');
const faker = require('faker');
const {
  from
} = require('rxjs');
const {
  mergeMap
} = require('rxjs/operators');
const Utils = require('../../../src/utils/Utils');
const OrganizationContext = require('./OrganizationContext');

class TenantContext {

  constructor(contextName, tenant, centralService, ocppRequestHandler) {
    this.contextName = contextName;
    this.tenant = tenant;
    this.centralServerService = centralService;
    this.ocpp16 = new OCPPJsonService16(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP16/${this.tenant.id}`, ocppRequestHandler);
    this.ocpp15 = new OCPPJsonService15(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP15/${this.tenant.id}`);
    this.context = {
      companies: [],
      users: [],
      organizationContexts: []
    };
  }

  getTenant() {
    return this.tenant;
  }

  getCentralServerService() {
    return this.centralServerService;
  }

  getOCPPService(ocppVersion) {
    if (ocppVersion === '1.6') {
      return this.ocpp16;
    } else if (ocppVersion === '1.5') {
      return this.ocpp15;
    } else {
      throw new Error('unkown ocpp version');
    }
  }

  getContext() {
    return this.context;
  }

  getOrganizationContexts() {
    return this.context.organizationContexts;
  }

  getOrganizationContext(organizationContextName = null) {
    if (organizationContextName) {
      return this.context.organizationContexts.find((organizationContext) => {
        return organizationContext.getOrganizationContextName() === organizationContextName;
      });
    } else {
      return this.context.organizationContexts[0]; // by default return the first context
    }
  }

  initializeContext() {
    this.context = {
      companies: [],
      users: [],
      organizationContexts: []
    };
  }

  addOrganizationContext(organizationContext) {
    this.context.organizationContexts.push(organizationContext);
  }

  async destroy() {
    if (this.ocpp16) {
      this.ocpp16.closeConnection();
    }
    await this.executeOnAll(this.context.users, user => this.centralServerService.deleteEntity(
      this.centralServerService.userApi, user, false));
    await this.context.organizationContexts.forEach(async (organizationContext) => {
      await organizationContext.destroy(this.centralServerService);
    });
    await this.context.companies.forEach(company => this.centralServerService.deleteEntity(
      this.centralServerService.companyApi, company, false));
  }

  async createUser(user = Factory.user.build()) {
    const createdUser = await this.centralServerService.createEntity(this.centralServerService.userApi, user);
    this.context.users.push(createdUser);
    return createdUser;
  }

  async createCompany(company = Factory.company.build()) {
    const createdCompany = await this.centralServerService.createEntity(this.centralServerService.companyApi, company);
    this.context.companies.push(createdCompany);
    return createdCompany;
  }

  async createSite(company, users, organizationContextName = null, site = Factory.site.build({
    companyID: company.id,
    userIDs: users.map(user => user.id)
  })) {
    const organizationContext = this.getOrganizationContext(organizationContextName);
    return await organizationContext.addSite(site, this.centralServerService);
  }

  async createSiteArea(site, chargingStations, organizationContextName = null, siteArea = Factory.siteArea.build({
    siteID: site.id,
    chargeBoxIDs: chargingStations.map(chargingStation => chargingStation.id)
  })) {
    const organizationContext = this.getOrganizationContext(organizationContextName);
    return await organizationContext.addSiteArea(site, chargingStations, siteArea, this.centralServerService);
  }

  async createChargingStation(ocppVersion, organizationContextName, chargingStation = Factory.chargingStation.build({
    id: faker.random.alphaNumeric(12)
  }), numberOfConnectors = 2) {
    const response = await this.getOCPPService(ocppVersion).executeBootNotification(
      chargingStation.id, chargingStation);
    expect(response.data).to.not.be.null;
    expect(response.data.status).to.eql('Accepted');
    expect(response.data).to.have.property('currentTime');
    const createdChargingStation = await this.centralServerService.getEntityById(
      this.centralServerService.chargingStationApi, chargingStation);
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
      await this.getOCPPService(ocppVersion).executeStatusNotification(createdChargingStation.id, connector);
      expect(response).to.not.be.null;
      expect(response.data.status).to.equal('Accepted');
    }
    return await this.getOrganizationContext(organizationContextName).addChargingStation(createdChargingStation);
  }

  async assignChargingStation(chargingStation, siteArea) {
    const readChargingStation = (await this.centralServerService.getEntityById(this.centralServerService.chargingStationApi, chargingStation, false)).data;
    readChargingStation.siteArea = siteArea;
    const response = await this.centralServerService.chargingStationApi.updateParams(readChargingStation);
    expect(response.status).to.be.equal(200);
    expect(response.data.status).to.equal('Success');
    return response;
  }

  async executeOnAll(array, method) {
    await from(array).pipe(
      mergeMap(method, 50)
    ).toPromise();
  }

  async close() {
    if (this.ocpp16) {
      this.ocpp16.closeConnection();
    }
  }

  async authorize(chargingStation, tagId, expectedStatus = 'Accepted') {
    const response = await this.getOCPPService(chargingStation.ocppVersion).executeAuthorize(chargingStation.id, {
      idTag: tagId
    });
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal(expectedStatus);
    return response.data;
  }

  async startTransaction(chargingStation, connectorId, tagId, meterStart, startDate, expectedStatus = 'Accepted') {
    const response = await this.getOCPPService(chargingStation.ocppVersion).executeStartTransaction(chargingStation.id, {
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
      this.addStartedTransaction(chargingStation, response.data);
    } else {
      expect(response.data.transactionId).to.equal(0);
    }
    return response.data.transactionId;
  }

  addStartedTransaction(chargingStation, transaction) {
    this.getOrganizationContexts().forEach((organizationContext) => {
      organizationContext.addTransactionStarted(chargingStation, transaction);
    });
  }

  addStoppedTransaction(chargingStation, transaction) {
    this.getOrganizationContexts().forEach((organizationContext) => {
      organizationContext.addTransactionStopped(chargingStation, transaction);
    });

  }

  getGeneratedTransactionList(chargingStation) {
    return this.getOrganizationContexts().forEach((organizationContext) => {
      return organizationContext.getTransactionsGenerated(chargingStation) !== null;
    });
  }

  async stopTransaction(chargingStation, transactionId, tagId, meterStop, stopDate) {
    const response = await this.getOCPPService(chargingStation.ocppVersion).executeStopTransaction(chargingStation.id, {
      transactionId: transactionId,
      idTag: tagId,
      meterStop: meterStop,
      timestamp: stopDate.toISOString()
    });
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
    this.addStoppedTransaction(chargingStation, response.data);
  }


  async sendConsumptionMeterValue(chargingStation, connectorId, transactionId, meterValue, timestamp) {
    const response = await this.getOCPPService(chargingStation.ocppVersion).executeMeterValues(chargingStation.id, {
      connectorId: connectorId,
      transactionId: transactionId,
      meterValue: {
        timestamp: timestamp.toISOString(),
        sampledValue: [{
          value: meterValue,
          format: "Raw",
          measurand: "Energy.Active.Import.Register",
          unit: 'Wh',
          location: "Outlet",
          context: "Sample.Periodic"
        }]

      },
    });
    expect(response.data).to.eql({});
  }

  async sendSoCMeterValue(chargingStation, connectorId, transactionId, meterValue, timestamp) {
    const response = await this.getOCPPService(chargingStation.ocppVersion).executeMeterValues(chargingStation.id, {
      connectorId: connectorId,
      transactionId: transactionId,
      meterValue: {
        timestamp: timestamp.toISOString(),
        sampledValue: [{
          value: meterValue,
          format: "Raw",
          measurand: "SoC",
          context: "Sample.Periodic"
        }]

      },
    });
    expect(response.data).to.eql({});
  }

  async sendClockMeterValue(chargingStation, connectorId, transactionId, meterValue, timestamp) {
    const response = await this.getOCPPService(chargingStation.ocppVersion).executeMeterValues(chargingStation.id, {
      connectorId: connectorId,
      transactionId: transactionId,
      meterValue: {
        timestamp: timestamp.toISOString(),
        sampledValue: [{
          value: meterValue,
          format: "Raw",
          measurand: "Energy.Active.Import.Register",
          unit: 'Wh',
          location: "Outlet",
          context: "Sample.Clock"
        }]

      },
    });
    expect(response.data).to.eql({});
  }

  async setConnectorStatus(chargingStation, connectorId, status, timestamp) {
    const connector = Utils.duplicateJSON(chargingStation.connectors[connectorId]);
    connector.status = status;
    connector.timestamp = timestamp.toISOString();
    const response = await this.getOCPPService(chargingStation.ocppVersion).executeStatusNotification(chargingStation.id, connector);
    expect(response.data).to.eql({});
    chargingStation.connectors[connectorId].status = connector.status;
    chargingStation.connectors[connectorId].timestamp = connector.timestamp;
  }

  getConfigurationOf(chargingStation) {
    const configuration = {
      "stationTemplate": {
        "baseName": "CS-" + faker.random.alphaNumeric(10),
        "chargePointModel": chargingStation.chargePointModel,
        "chargePointVendor": chargingStation.chargePointVendor,
        "power": [7200, 16500, 22000, 50000],
        "powerUnit": "W",
        "numberOfConnectors": chargingStation.connectors.length,
        "randomConnectors": false,
        "Configuration": {
          "NumberOfConnectors": chargingStation.connectors.length,
          "param1": "test",
          "meterValueInterval": 60
        },
        "AutomaticTransactionGenerator": {
          "enable": true,
          "minDuration": 70,
          "maxDuration": 180,
          "minDelayBetweenTwoTransaction": 30,
          "maxDelayBetweenTwoTransaction": 60,
          "probabilityOfStart": 1,
          "stopAutomaticTransactionGeneratorAfterHours": 0.3
        },
        "Connectors": {}
      }
    };
    chargingStation.connectors.forEach(connector => {
      configuration.Connectors[connector.connectorId] = {
        "MeterValues": [{
          "unit": "Percent",
          "context": "Sample.Periodic",
          "measurand": "SoC",
          "location": "EV"
        }, {
          "unit": "Wh",
          "context": "Sample.Periodic"
        }]
      };
    });
    return configuration;
  }

}

module.exports = TenantContext;