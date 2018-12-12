const chai = require('chai');
const {expect} = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const moment = require('moment');
const faker = require('faker');
const DataHelper = require('./DataHelper');
const CentralServerService = require('../api/client/CentralServerService');
const Factory = require('../factories/Factory');

describe('ChargingStation Keba tests', function() {
  this.timeout(10000);
  before(async () => {
  });

  after(async () => {
    this.dataHelper.close();
    this.dataHelper.destroyData();
  });


  it('Should not take care about keba clock meterValues', async () => {
    // const requestHandler = [];
    this.tenantID = await CentralServerService.authenticatedApi.getTenantID();

    this.dataHelper = new DataHelper('1.6', this.tenantID);
    const user = await this.dataHelper.createUser();
    const company = await this.dataHelper.createCompany();
    const site = await this.dataHelper.createSite(company, [user]);
    const chargingStation = await this.dataHelper.createChargingStation(Factory.chargingStation.build({
      chargePointVendor: 'Keba AG',
      id: faker.random.alphaNumeric(12)
    }), 1);
    await this.dataHelper.createSiteArea(site, [chargingStation]);
    const connectorId = 1;
    const tagId = user.tagIDs[0];
    const meterStart = 0;
    const startDate = moment();
    const currentTime = startDate.clone();
    let cumulated = meterStart;
    const transactionId = await this.dataHelper.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
    await this.dataHelper.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await this.dataHelper.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await this.dataHelper.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await this.dataHelper.sendClockMeterValue(chargingStation, connectorId, transactionId, 0, currentTime.clone());
    await this.dataHelper.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await this.dataHelper.stopTransaction(chargingStation, transactionId, tagId, cumulated, currentTime.add(1, 'minute').clone());

    const response = await CentralServerService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.deep.include({
      id: transactionId,
      currentConsumption: 0,
      totalConsumption: cumulated - meterStart,
      totalInactivitySecs: 0,
      meterStart: meterStart,
    });


  });

});

