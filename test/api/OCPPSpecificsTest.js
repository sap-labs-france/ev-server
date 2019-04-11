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

describe('Keba tests', function() {
  this.timeout(10000);
  
  before(async () => {
    this.dataHelper = new DataHelper('1.6', this.tenantID);
    this.user = await this.dataHelper.createUser();
    this.company = await this.dataHelper.createCompany();
    this.site = await this.dataHelper.createSite(this.company, [this.user]);
    this.chargingStation = await this.dataHelper.createChargingStation(
      Factory.chargingStation.build({
        chargePointVendor: 'Keba AG',
        id: faker.random.alphaNumeric(12)
      }), 1);
    this.siteArea = await this.dataHelper.createSiteArea(this.site, [this.chargingStation]);
  });

  after(async () => {
    this.dataHelper.close();
    this.dataHelper.destroyData();
  });


  it('KEBA Sample.Clock in MeterValues should not be taken into account', async () => {
    // const requestHandler = [];
    this.tenantID = await CentralServerService.authenticatedApi.getTenantID();
    const connectorId = 1;
    const tagId = user.tagIDs[0];
    const meterStart = 0;
    const startDate = moment();
    const currentTime = startDate.clone();
    let cumulated = meterStart;
    const transactionId = await this.dataHelper.startTransaction(this.chargingStation, connectorId, tagId, meterStart, startDate);
    await this.dataHelper.sendConsumptionMeterValue(this.chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await this.dataHelper.sendConsumptionMeterValue(this.chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await this.dataHelper.sendConsumptionMeterValue(this.chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await this.dataHelper.sendClockMeterValue(this.chargingStation, connectorId, transactionId, 0, currentTime.clone());
    await this.dataHelper.sendConsumptionMeterValue(this.chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await this.dataHelper.stopTransaction(this.chargingStation, transactionId, tagId, cumulated, currentTime.add(1, 'minute').clone());
    // Read the transaction
    const response = await CentralServerService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.deep.containSubset({
      id: transactionId,
      meterStart: meterStart,
      stop: {
        totalConsumption: cumulated - meterStart,
        totalInactivitySecs: 60
      }
    });
  });
});

