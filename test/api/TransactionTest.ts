import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import faker from 'faker';
import moment from 'moment';
import CentralServerService from '../api/client/CentralServerService';
import DataHelper from './DataHelper';

chai.use(chaiSubset);

class TestData {
  public centralServerService: CentralServerService;
  public tenantID: string;
  public dataHelper16: any;

  public constructor() {
    this.centralServerService = new CentralServerService();
  }

  public async init(): Promise<void> {
    this.tenantID = await this.centralServerService.authenticatedApi.getTenantID();
    this.dataHelper16 = new DataHelper('1.6', this.tenantID);
  }
}

let testData: TestData;

describe('Transaction tests', function() {
  this.timeout(10000);
  before(async () => {
    testData = new TestData();
    await testData.init();
  });

  after(async () => {
    testData.dataHelper16.close();
    testData.dataHelper16.destroyData();
  });

  describe('readById', () => {
    it('read a not existing transaction', async () => {
      const response = await testData.centralServerService.transactionApi.readById(faker.random.number(100000));
      expect(response.status).to.equal(550);
    });
    it('read with invalid id', async () => {
      const response = await testData.centralServerService.transactionApi.readById('&é"\'(§è!çà)');
      expect(response.status).to.equal(550);
    });
    it('read without providing id', async () => {
      const response = await testData.centralServerService.transactionApi.readById(null);
      expect(response.status).to.equal(500);
    });
    it('read a started transaction', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = faker.random.number({ min: 0, max: 1000 });
      const startDate = moment();

      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      const response = await testData.centralServerService.transactionApi.readById(transactionId);
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset({
        id: transactionId,
        timestamp: startDate.toISOString(),
        connectorId: connectorId,
        tagID: tagId,
        chargeBoxID: chargingStation.id,
        currentConsumption: 0,
        currentTotalConsumption: 0,
        currentTotalInactivitySecs: 0,
        meterStart: meterStart,
        user: {
          id: user.id,
          firstName: user.firstName,
          name: user.name,
        }
      });
    });
    it('read a started transaction with one meter value', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 180;
      const startDate = moment();
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);

      const load = 100;
      const currentTime = startDate.clone().add(1, 'hour');
      await testData.dataHelper16.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, meterStart + load, currentTime);

      const response = await testData.centralServerService.transactionApi.readById(transactionId);
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset({
        id: transactionId,
        timestamp: startDate.toISOString(),
        connectorId: connectorId,
        tagID: tagId,
        chargeBoxID: chargingStation.id,
        currentConsumption: load,
        currentTotalConsumption: load,
        currentTotalInactivitySecs: 0,
        meterStart: meterStart,
        user: {
          id: user.id,
          firstName: user.firstName,
          name: user.name,
        }
      });
    });
    it('read a started transaction with multiple meter values', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 180;
      const startDate = moment();
      const currentTime = startDate.clone();
      let cumulated = meterStart;
      let load = 0;
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);

      load = 100;
      cumulated += load;
      currentTime.add(1, 'hour');
      await testData.dataHelper16.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated, currentTime);

      load = 50;
      cumulated += load;
      currentTime.add(1, 'hour');
      await testData.dataHelper16.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated, currentTime);

      const response = await testData.centralServerService.transactionApi.readById(transactionId);
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset({
        id: transactionId,
        currentConsumption: load,
        currentTotalConsumption: cumulated - meterStart,
        currentTotalInactivitySecs: 0,
        meterStart: meterStart,
      });
    });
    it('read a closed transaction without meter values and no meterStart', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const meterStop = 0;
      const startDate = moment();
      const stopDate = startDate.clone().add(1, 'hour');
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId, tagId, meterStop, stopDate);

      const response = await testData.centralServerService.transactionApi.readById(transactionId);
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset({
        id: transactionId,
        meterStart: meterStart,
        stop: {
          meterStop: meterStop,
          totalInactivitySecs: 3600,
          timestamp: stopDate.toISOString(),
          tagID: tagId,
        }
      });

    });
    it('read a closed transaction without meter values and a meterStart different from meterStop', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const meterStop = 1000;
      const startDate = moment();
      const stopDate = startDate.clone().add(1, 'hour');
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId, tagId, meterStop, stopDate);

      const response = await testData.centralServerService.transactionApi.readById(transactionId);
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset({
        id: transactionId,
        meterStart: meterStart,
        stop: {
          meterStop: meterStop,
          totalConsumption: 1000,
          totalInactivitySecs: 0,
          timestamp: stopDate.toISOString(),
          tagID: tagId,
        }
      });
    });
  });


  describe('readAllCompleted', () => {
    it('no transactions completed', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const startDate = moment();
      await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);

      const response = await testData.centralServerService.transactionApi.readAllCompleted({ ChargeBoxID: chargingStation.id });
      expect(response.status).to.equal(200);
      expect(response.data.count).to.equal(0);
    });
    it('some transactions completed without statistics', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const meterStop = 1000;
      const startDate = moment();
      const stopDate = startDate.clone().add(1, 'hour');
      const transactionId1 = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId1, tagId, meterStop, stopDate);
      const transactionId2 = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId2, tagId, meterStop, stopDate);

      const response = await testData.centralServerService.transactionApi.readAllCompleted({ ChargeBoxID: chargingStation.id });
      expect(response.status).to.equal(200);
      expect(response.data.count).to.equal(2);
      expect(response.data.stats).to.containSubset({ count: 2 });
      expect(response.data.result).to.containSubset([{
        id: transactionId1,
        meterStart: meterStart,
        stop: {
          totalConsumption: 1000,
          totalInactivitySecs: 0,
          meterStop: meterStop,
          timestamp: stopDate.toISOString(),
          tagID: tagId,
        }
      }, {
        id: transactionId2,
        meterStart: meterStart,
        stop: {
          meterStop: meterStop,
          totalConsumption: 1000,
          totalInactivitySecs: 0,
          timestamp: stopDate.toISOString(),
          tagID: tagId,
        }
      }]);
    });
    it('some transactions completed with historical statistics', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const meterStop = 1000;
      const startDate = moment();
      const stopDate = startDate.clone().add(1, 'hour');
      const transactionId1 = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId1, tagId, meterStop, stopDate);
      const transactionId2 = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId2, tagId, meterStop, stopDate);

      const response = await testData.centralServerService.transactionApi.readAllCompleted({ ChargeBoxID: chargingStation.id, Statistics: 'history' });
      expect(response.status).to.equal(200);
      expect(response.data.count).to.equal(2);
      expect(response.data.stats).to.containSubset({
        totalConsumptionWattHours: 2000,
        totalDurationSecs: 7200,
        totalPrice: 2,
        totalInactivitySecs: 0,
        count: 2
      }
      );
      expect(response.data.result).to.containSubset([{
        id: transactionId1,
        meterStart: meterStart,
        stop: {
          totalConsumption: 1000,
          totalInactivitySecs: 0,
          meterStop: meterStop,
          timestamp: stopDate.toISOString(),
          tagID: tagId,
        }
      }, {
        id: transactionId2,
        meterStart: meterStart,
        stop: {
          meterStop: meterStop,
          totalConsumption: 1000,
          totalInactivitySecs: 0,
          timestamp: stopDate.toISOString(),
          tagID: tagId,
        }
      }]);
    });

    it('some transactions completed with refund statistics', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const meterStop = 1000;
      const startDate = moment();
      const stopDate = startDate.clone().add(1, 'hour');
      const transactionId1 = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId1, tagId, meterStop, stopDate);
      const transactionId2 = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId2, tagId, meterStop, stopDate);

      const response = await testData.centralServerService.transactionApi.readAllCompleted({ UserId: user.id, ChargeBoxID: chargingStation.id, Statistics: 'refund' });
      expect(response.status).to.equal(200);
      expect(response.data.count).to.equal(2);
      expect(response.data.stats).to.containSubset({
        totalConsumptionWattHours: 2000,
        totalPriceRefund: 0,
        totalPricePending: 2,
        currency: 'EUR',
        countRefundTransactions: 0,
        countPendingTransactions: 2,
        countRefundedReports: 0,
        count: 2
      }
      );
      expect(response.data.result).to.containSubset([{
        id: transactionId1,
        meterStart: meterStart,
        stop: {
          totalConsumption: 1000,
          totalInactivitySecs: 0,
          meterStop: meterStop,
          timestamp: stopDate.toISOString(),
          tagID: tagId,
        }
      }, {
        id: transactionId2,
        meterStart: meterStart,
        stop: {
          meterStop: meterStop,
          totalConsumption: 1000,
          totalInactivitySecs: 0,
          timestamp: stopDate.toISOString(),
          tagID: tagId,
        }
      }]);
    });
  });

  describe('readAllInError', () => {
    it('no transactions in error', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const startDate = moment();
      await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      const response = await testData.centralServerService.transactionApi.readAllInError({ ChargeBoxID: chargingStation.id });
      expect(response.status).to.equal(200);
      expect(response.data.count).to.equal(0);
    });
    it('some transactions in error', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const meterStop = 1000;
      const startDate = moment();
      const stopDate = startDate.clone().add(1, 'hour');
      const transactionId1 = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId1, tagId, meterStart, stopDate);
      const transactionId2 = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId2, tagId, meterStop, stopDate);

      const response = await testData.centralServerService.transactionApi.readAllInError({ ChargeBoxID: chargingStation.id });
      expect(response.status).to.equal(200);
      expect(response.data.count).to.equal(2);
      expect(response.data.result).to.containSubset([{
        id: transactionId1,
        meterStart: meterStart,
        stop: {
          totalConsumption: 0,
          totalInactivitySecs: 3600,
          meterStop: meterStart,
          timestamp: stopDate.toISOString(),
          tagID: tagId,
        }
      }]);
    });
  });

  describe('readAllConsumption', () => {
    it('read consumption of a started transaction without meter values', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const startDate = moment();
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      // pragma await testData.dataHelper16.stopTransaction(chargingStation, transactionId, tagId, meterStop, stopDate);

      const response = await testData.centralServerService.transactionApi.readAllConsumption({ TransactionId: transactionId });
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: []
      });
    });
    it('read consumption of a started transaction with multiple meter values', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 180;
      const startDate = moment();
      const currentTime = startDate.clone();
      let cumulated = meterStart;
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);

      const meterValues = [
        {
          value: 100,
          timestamp: currentTime.add(1, 'hour').clone()
        },
        {
          value: 50,
          timestamp: currentTime.add(1, 'hour').clone()
        }
      ];

      for (const meterValue of meterValues) {
        cumulated += meterValue.value;
        await testData.dataHelper16.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated, meterValue.timestamp);
      }

      const response = await testData.centralServerService.transactionApi.readAllConsumption({ TransactionId: transactionId });
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[0].timestamp.toISOString(),
            value: meterValues[0].value,
            cumulated: meterValues[0].value
          },
          {
            date: meterValues[1].timestamp.toISOString(),
            value: meterValues[1].value,
            cumulated: cumulated - meterStart
          }
        ]
      });
    });

    it('read consumption of a started transaction with multiple meter values and different date parameters', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 180;
      const startDate = moment('2018-11-06T08:00:00.000Z');
      let cumulated = meterStart;
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);

      const meterValues = [
        {
          value: 100,
          timestamp: startDate.clone().add(1, 'hour')
        },
        {
          value: 50,
          timestamp: startDate.clone().add(2, 'hour')
        }
      ];

      for (const meterValue of meterValues) {
        cumulated += meterValue.value;
        await testData.dataHelper16.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated, meterValue.timestamp);
      }

      let response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().subtract(1, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(3);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[0].timestamp.toISOString(),
            value: meterValues[0].value,
            cumulated: meterValues[0].value
          },
          {
            date: meterValues[1].timestamp.toISOString(),
            value: meterValues[1].value,
            cumulated: cumulated - meterStart
          }
        ]
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().subtract(2, 'hour').toISOString(),
        EndDateTime: startDate.clone().subtract(1, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(0);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: []
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
        EndDateTime: startDate.clone().subtract(0, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(0);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: []
      });


      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
        EndDateTime: startDate.clone().add(30, 'minutes').toISOString()
      });
      expect(response.data.values).has.lengthOf(0);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: []
      });
      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
        EndDateTime: startDate.clone().add(1, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(2);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[0].timestamp.toISOString(),
            value: meterValues[0].value,
            cumulated: meterValues[0].value
          }
        ]
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
        EndDateTime: startDate.clone().add(1.5, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(2);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[0].timestamp.toISOString(),
            value: meterValues[0].value,
            cumulated: meterValues[0].value
          }
        ]
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
        EndDateTime: startDate.clone().add(3, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(3);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[0].timestamp.toISOString(),
            value: meterValues[0].value,
            cumulated: meterValues[0].value
          },
          {
            date: meterValues[1].timestamp.toISOString(),
            value: meterValues[1].value,
            cumulated: meterValues[1].value + meterValues[0].value
          }
        ]
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().add(1, 'hour').toISOString(),
        EndDateTime: startDate.clone().add(2, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(3);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[0].timestamp.toISOString(),
            value: meterValues[0].value,
            cumulated: meterValues[0].value
          },
          {
            date: meterValues[1].timestamp.toISOString(),
            value: meterValues[1].value,
            cumulated: meterValues[1].value + meterValues[0].value
          }
        ]
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().add(1.5, 'hour').toISOString(),
        EndDateTime: startDate.clone().add(2, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(2);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[1].timestamp.toISOString(),
            value: meterValues[1].value,
            cumulated: meterValues[1].value + meterValues[0].value
          }
        ]
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().add(2, 'hour').toISOString(),
        EndDateTime: startDate.clone().add(3, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(2);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[1].timestamp.toISOString(),
            value: meterValues[1].value,
            cumulated: meterValues[1].value + meterValues[0].value
          }
        ]
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        StartDateTime: startDate.clone().add(2.5, 'hour').toISOString(),
        EndDateTime: startDate.clone().add(3, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(0);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: []
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        EndDateTime: startDate.clone().toISOString()
      });
      expect(response.data.values).has.lengthOf(0);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: []
      });

      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        EndDateTime: startDate.clone().add(1, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(2);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[0].timestamp.toISOString(),
            value: meterValues[0].value,
            cumulated: meterValues[0].value
          }
        ]
      });
      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        EndDateTime: startDate.clone().add(2.5, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(3);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[0].timestamp.toISOString(),
            value: meterValues[0].value,
            cumulated: meterValues[0].value
          },
          {
            date: meterValues[1].timestamp.toISOString(),
            value: meterValues[1].value,
            cumulated: meterValues[1].value + meterValues[0].value
          }
        ]
      });
      response = await testData.centralServerService.transactionApi.readAllConsumption({
        TransactionId: transactionId,
        EndDateTime: startDate.clone().add(4, 'hour').toISOString()
      });
      expect(response.data.values).has.lengthOf(3);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: meterValues[0].timestamp.toISOString(),
            value: meterValues[0].value,
            cumulated: meterValues[0].value
          },
          {
            date: meterValues[1].timestamp.toISOString(),
            value: meterValues[1].value,
            cumulated: meterValues[1].value + meterValues[0].value
          }
        ]
      });
    });
    it('read consumption of a stopped transaction without meter values', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const meterStop = 1000;
      const startDate = moment();
      const stopDate = startDate.clone().add(1, 'hour');
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId, tagId, meterStop, stopDate);

      const response = await testData.centralServerService.transactionApi.readAllConsumption({ TransactionId: transactionId });
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset({
        id: transactionId,
        values: [
          {
            date: stopDate.toISOString(),
            value: meterStop - meterStart,
            cumulated: meterStop
          }
        ]
      });
    });
  });

  describe('getTransactionsActive', () => {
    it('read on a charger without active transactions', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const response = await testData.centralServerService.transactionApi.readAllActive({ ChargeBoxID: chargingStation.id });
      expect(response.status).to.equal(200);
      expect(response.data.count).to.equal(0);
    });
    it('read on a charger with multiple active transactions', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId1 = 1;
      const connectorId2 = 2;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const meterStop = 1000;
      const startDate = moment();
      const stopDate = startDate.clone().add(1, 'hour');
      const transactionId1 = await testData.dataHelper16.startTransaction(chargingStation, connectorId1, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId1, tagId, meterStop, stopDate);
      const transactionId2 = await testData.dataHelper16.startTransaction(chargingStation, connectorId1, tagId, meterStart, startDate);
      const transactionId3 = await testData.dataHelper16.startTransaction(chargingStation, connectorId2, tagId, meterStart, startDate);


      const response = await testData.centralServerService.transactionApi.readAllActive({ ChargeBoxID: chargingStation.id });
      expect(response.status).to.equal(200);
      expect(response.data.count).to.equal(2);
      expect(response.data.result).to.containSubset([
        {
          id: transactionId2
        }, {
          id: transactionId3
        }
      ]);
    });
  });
  describe('delete', () => {
    it('delete a not existing transaction', async () => {
      const response = await testData.centralServerService.transactionApi.delete(faker.random.number(100000));
      expect(response.status).to.equal(550);
    });
    it('delete with invalid id', async () => {
      const response = await testData.centralServerService.transactionApi.delete('&é"\'(§è!çà)');
      expect(response.status).to.equal(550);
    });
    it('delete without providing id', async () => {
      const response = await testData.centralServerService.transactionApi.delete(null);
      expect(response.status).to.equal(500);
    });
    it('delete a started transaction', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const startDate = moment();
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      let response = await testData.centralServerService.transactionApi.delete(transactionId);
      expect(response.status).to.equal(200);
      response = await testData.centralServerService.transactionApi.readById(transactionId);
      expect(response.status).to.equal(550);
    });
    it('delete a closed transaction', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 0;
      const meterStop = 1000;
      const startDate = moment();
      const stopDate = startDate.clone().add(1, 'hour');
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.dataHelper16.stopTransaction(chargingStation, transactionId, tagId, meterStop, stopDate);
      let response = await testData.centralServerService.transactionApi.delete(transactionId);
      expect(response.status).to.equal(200);
      response = await testData.centralServerService.transactionApi.readById(transactionId);
      expect(response.status).to.equal(550);
    });
  });
  xit('a mail notification should be received when starting a transaction', async () => {
    const user = await testData.dataHelper16.createUser();
    const company = await testData.dataHelper16.createCompany();
    const site = await testData.dataHelper16.createSite(company, [user]);
    const chargingStation = await testData.dataHelper16.createChargingStation();
    await testData.dataHelper16.createSiteArea(site, [chargingStation]);
    const connectorId = 1;
    const tagId = user.tagIDs[0];
    const meterStart = 180;
    const startDate = moment();
    const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
    const currentDate = startDate.clone();

    const meterValues = [
      {
        value: 100,
        timestamp: currentDate.add(1, 'hour').clone()
      },
      {
        value: 50,
        timestamp: currentDate.add(23, 'minutes').clone()
      },
      {
        value: 0,
        timestamp: currentDate.add(1, 'hour').clone()
      },
      {
        value: 0,
        timestamp: currentDate.add(1, 'hour').clone()
      }
    ];

    let cumulated = meterStart;
    for (const meterValue of meterValues) {
      cumulated += meterValue.value;
      await testData.dataHelper16.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated, meterValue.timestamp);
    }
    await timeout(2000);
    expect(await testData.centralServerService.mailApi.isMailReceived(user.email, 'transaction-started')).is.equal(true, 'transaction-started mail');
    expect(await testData.centralServerService.mailApi.isMailReceived(user.email, 'end-of-charge')).is.equal(true, 'end-of-charge mail');

    await testData.dataHelper16.stopTransaction(chargingStation, transactionId, tagId, cumulated + 50, currentDate.add(1, 'hour'));

  });

  it('inactivity should be computed', async () => {
    const user = await testData.dataHelper16.createUser();

    const company = await testData.dataHelper16.createCompany();
    const site = await testData.dataHelper16.createSite(company, [user]);
    const chargingStation = await testData.dataHelper16.createChargingStation();
    await testData.dataHelper16.createSiteArea(site, [chargingStation]);
    const connectorId = 1;
    const tagId = user.tagIDs[0];
    const meterStart = 180;
    const startDate = moment();
    const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
    const currentDate = startDate.clone();

    const meterValues = [
      {
        value: 100,
        timestamp: currentDate.add(1, 'hour').clone()
      },
      {
        value: 50,
        timestamp: currentDate.add(1, 'hour').clone()
      },
      {
        value: 0,
        timestamp: currentDate.add(1, 'hour').clone()
      },
      {
        value: 0,
        timestamp: currentDate.add(1, 'hour').clone()
      },
      {
        value: 0,
        timestamp: currentDate.add(1, 'hour').clone()
      },
      {
        value: 0,
        timestamp: currentDate.add(1, 'hour').clone()
      }
    ];

    let cumulated = meterStart;
    for (const meterValue of meterValues) {
      cumulated += meterValue.value;
      await testData.dataHelper16.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated, meterValue.timestamp);
    }

    await testData.dataHelper16.stopTransaction(chargingStation, transactionId, tagId, cumulated, currentDate.add(1, 'hour'));
    const response = await testData.centralServerService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.containSubset({
      id: transactionId,
      stop: {
        totalDurationSecs: 7 * 3600,
        totalInactivitySecs: 5 * 3600
      }
    });
  });
  describe('pricing', () => {
    it('total price', async () => {
      const user = await testData.dataHelper16.createUser();
      const company = await testData.dataHelper16.createCompany();
      const site = await testData.dataHelper16.createSite(company, [user]);
      const chargingStation = await testData.dataHelper16.createChargingStation();
      await testData.dataHelper16.createSiteArea(site, [chargingStation]);
      const connectorId = 1;
      const tagId = user.tagIDs[0];
      const meterStart = 180;
      const startDate = moment();
      const transactionId = await testData.dataHelper16.startTransaction(chargingStation, connectorId, tagId, meterStart, startDate);
      await testData.centralServerService.updatePriceSetting(1.5, 'EUR');

      const currentDate = startDate.clone();

      const meterValues = [
        {
          value: 100,
          timestamp: currentDate.add(1, 'hour').clone()
        },
        {
          value: 50,
          timestamp: currentDate.add(1, 'hour').clone()
        },
        {
          value: 0,
          timestamp: currentDate.add(1, 'hour').clone()
        },
        {
          value: 0,
          timestamp: currentDate.add(1, 'hour').clone()
        },
        {
          value: 0,
          timestamp: currentDate.add(1, 'hour').clone()
        },
        {
          value: 0,
          timestamp: currentDate.add(1, 'hour').clone()
        }
      ];

      let cumulated = meterStart;
      for (const meterValue of meterValues) {
        cumulated += meterValue.value;
        await testData.dataHelper16.sendConsumptionMeterValue(chargingStation, connectorId, transactionId, cumulated, meterValue.timestamp);
      }

      await testData.dataHelper16.stopTransaction(chargingStation, transactionId, tagId, cumulated, currentDate.add(1, 'hour'));
      const response = await testData.centralServerService.transactionApi.readById(transactionId);
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset({
        id: transactionId,
        stop: {
          totalDurationSecs: 7 * 3600,
          totalInactivitySecs: 5 * 3600
        }
      });
    });
  });
});


async function timeout(ms) {
  // eslint-disable-next-line no-undef
  return await new Promise((resolve) => {
    return setTimeout(resolve, ms);
  });
}
