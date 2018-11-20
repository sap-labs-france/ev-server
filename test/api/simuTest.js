const chai = require('chai');
const {expect} = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const moment = require('moment');
const faker = require('faker');
const DataHelper = require('./DataHelper');
const CentralServerService = require('../api/client/CentralServerService');

describe('Transaction tests', function() {
  this.timeout(10000);
  before(async () => {
    this.tenantID = await CentralServerService.authenticatedApi.getTenantID();
    this.dataHelper = new DataHelper('1.6', this.tenantID);
  });

  after(async () => {
    this.dataHelper.close();
    // this.dataHelper.destroyData();
  });

  it('read a started transaction with one meter value', async () => {
    const user = await this.dataHelper.createUser();
    const company = await this.dataHelper.createCompany();
    const site = await this.dataHelper.createSite(company, [user]);
    const chargingStation = await this.dataHelper.createChargingStation();
    await this.dataHelper.createSiteArea(site, [chargingStation]);
    const connectorId = 1;
    const tagId = user.tagIDs[0];
    const meterStart = 180;
    const transactionMeterValueIntervalSecs = 60;
    const numberOfMeterValues = 100;
    const transactionStartTime = moment().subtract(numberOfMeterValues * transactionMeterValueIntervalSecs, "seconds");
    const transactionMeterValues = Array.from({length: numberOfMeterValues}, (value, index) => ({
      timestamp: transactionStartTime.clone().add(index * 60 + 60),
      value: faker.random.number({min: 200, max: 500})
    }));
    const transactionId = await this.dataHelper.startTransaction(chargingStation, connectorId, tagId, meterStart, transactionStartTime);
    const promises = [];
    for (const transactionMeterValue of transactionMeterValues) {
      promises.push(this.dataHelper.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, transactionMeterValue.value, transactionMeterValue.timestamp));
    }
    await Promise.all(promises);
  });
});


function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}