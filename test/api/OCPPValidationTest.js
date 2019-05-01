const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const chai = require('chai');
const {expect} = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const moment = require('moment');
const faker = require('faker');
const DataHelper = require('./DataHelper');
const CentralServerService = require('../api/client/CentralServerService');
const Factory = require('../factories/Factory');

describe('OCPP Validation tests', function() {
  this.timeout(10000);
  before(async () => {
    this.tenantID = await CentralServerService.authenticatedApi.getTenantID();
    this.dataHelper = new DataHelper('1.6', this.tenantID);

    this.validTag = faker.random.alphaNumeric(20).toString();
    this.invalidTag = faker.random.alphaNumeric(21).toString();
    this.numberTag = faker.random.number(10000);
    this.defaultUser = await this.dataHelper.createUser(Factory.user.build({tagIDs: [this.validTag, this.invalidTag, this.numberTag.toString()]}));

    this.defaultCompany = await this.dataHelper.createCompany();
    this.defaultSite = await this.dataHelper.createSite(this.defaultCompany, [this.defaultUser]);

    this.defaultConnectorId = 1;
    this.defaultMeterStart = 0;
    this.defaultChargingStation = await this.dataHelper.createChargingStation();
    await this.dataHelper.createSiteArea(this.defaultSite, [this.defaultChargingStation]);
  });

  after(async () => {
    this.dataHelper.close();
    this.dataHelper.destroyData();
  });

  it('Should be possible to authorize a user with tag as integer', async () => {
    await this.dataHelper.authorize(this.defaultChargingStation, this.numberTag);
    await this.dataHelper.authorize(this.defaultChargingStation, this.numberTag.toString());
  });

  it('Should not be possible to authorize a user with a invalid tags', async () => {
    await this.dataHelper.authorize(this.defaultChargingStation, this.invalidTag, "Invalid");
    await this.dataHelper.authorize(this.defaultChargingStation, '', "Invalid");
    await this.dataHelper.authorize(this.defaultChargingStation, undefined, "Invalid");
  });

  it('Should be possible to start a transaction with tag as integer', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag.toString(), this.defaultMeterStart, moment());
  });

  it('Should be possible to start a transaction with connectorId as string', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId.toString(), this.numberTag.toString(), this.defaultMeterStart, moment());
  });

  it('Should be possible to start a transaction with meterStart as string', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag.toString(), this.defaultMeterStart.toString(), moment());
  });

  it('Should not be possible to start a transaction with a invalid tags', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.invalidTag, this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, '', this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, undefined, this.defaultMeterStart, moment(), "Invalid");
  });

  it('Should not be possible to start a transaction with invalid connectorId', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, 'bla', this.numberTag, this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, '', this.numberTag.toString(), this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, -1, this.numberTag.toString(), this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, undefined, this.numberTag.toString(), this.defaultMeterStart, moment(), "Invalid");
  });

  it('Should not be possible to start a transaction with invalid meterStart', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, 'bla', moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag.toString(), '', moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag.toString(), undefined, moment(), "Invalid");
  });
});

