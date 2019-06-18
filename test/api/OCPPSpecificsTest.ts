import chai from 'chai';
import {expect} from 'chai';
import chaiSubset from 'chai-subset';
chai.use(chaiSubset);
import moment from 'moment';
import faker from 'faker';
import DataHelper from './DataHelper';
const path = require('path');
import TSGlobal from '../../src/types/GlobalType';
declare const global: TSGlobal;
global.appRoot = path.resolve(__dirname, '../../src');
import CentralServerService from './client/CentralServerService';
import Factory from '../factories/Factory';

class TestData {
  public dataHelper: DataHelper;
  public tenantID: string;

  constructor() {
  }

  async init() {
    this.tenantID = await CentralServerService.DefaultInstance.authenticatedApi.getTenantID();
    this.dataHelper = new DataHelper('1.6', this.tenantID);
  }
}

const testData: TestData = new TestData();

describe('ChargingStation Keba tests', function() {
  this.timeout(10000);
  before(async () => {
    testData.init();
  });

  after(async () => {
    testData.dataHelper.close();
    testData.dataHelper.destroyData();
  });


  it('Should not take care about keba clock meterValues', async () => {
    // const requestHandler = [];
    testData.tenantID = await CentralServerService.DefaultInstance.authenticatedApi.getTenantID();

    testData.dataHelper = new DataHelper('1.6', testData.tenantID);
    const user = await testData.dataHelper.createUser();
    const company = await testData.dataHelper.createCompany();
    const site = await testData.dataHelper.createSite(company, [user]);
    const chargingStation = await testData.dataHelper.createChargingStation(Factory.chargingStation.build({
      chargePointVendor: 'Keba AG',
      id: faker.random.alphaNumeric(12)
    }), 1);
    await testData.dataHelper.createSiteArea(site, [chargingStation]);
    const connectorId = 1;
    const tagId = user.tagIDs[0];
    const meterStart = 0;
    const startDate = moment();
    const currentTime = startDate.clone();
    let cumulated = meterStart;
    const transactionId = await testData.dataHelper.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
    await testData.dataHelper.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await testData.dataHelper.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await testData.dataHelper.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await testData.dataHelper.sendClockMeterValue(chargingStation, connectorId, transactionId, 0, currentTime.clone());
    await testData.dataHelper.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
    await testData.dataHelper.stopTransaction(chargingStation, transactionId, tagId, cumulated, currentTime.add(1, 'minute').clone(), {});

    const response = await CentralServerService.DefaultInstance.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.deep['containSubset']({
      id: transactionId,
      meterStart: meterStart,
      stop: {
        totalConsumption: cumulated - meterStart,
        totalInactivitySecs: 60
      }
    });
  });
});

