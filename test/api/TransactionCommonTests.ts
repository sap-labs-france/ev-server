import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import faker from 'faker';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';
import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './contextProvider/ChargingStationContext';
import Factory from '../factories/Factory';

chai.use(chaiSubset);
chai.use(responseHelper);

export default class TransactionCommonTests {

  public tenantContext: any;
  public chargingStationContext: ChargingStationContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;

  public currentPricingSetting;
  public priceKWH = 2;
  public chargingStationConnector1: any;
  public chargingStationConnector2: any;
  public transactionUser: any;
  public transactionUserService: any;
  public transactionStartMeterValue: any;
  public transactionStartSoC: any;
  public transactionMeterValues: any;
  public transactionMeterSoCValues: any;
  public transactionSignedData: any;
  public transactionEndSignedData: any;
  public transactionMeterValueIntervalSecs: any;
  public transactionStartTime: any;
  public transactionTotalConsumption: any;
  public transactionEndMeterValue: any;
  public transactionEndSoC: any;
  public transactionTotalInactivity: any;
  public totalPrice: any;
  public newTransaction: any;
  public transactionCurrentTime: any;

  public constructor(tenantContext, centralUserContext) {
    expect(tenantContext).to.exist;
    this.tenantContext = tenantContext;
    this.centralUserContext = centralUserContext;
    expect(centralUserContext).to.exist;
    this.centralUserService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.centralUserContext);
  }

  public setChargingStation(chargingStationContext) {
    expect(chargingStationContext).to.exist;
    this.chargingStationContext = chargingStationContext;
  }

  public setUser(userContext) {
    expect(userContext).to.exist;
    this.transactionUser = userContext;
    this.transactionUserService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.transactionUser);
  }

  public async before() {
    const allSettings = await this.centralUserService.settingApi.readAll({});
    this.currentPricingSetting = allSettings.data.result.find((s) => {
      return s.identifier === 'pricing';
    });
    if (this.currentPricingSetting) {
      await this.centralUserService.updatePriceSetting(this.priceKWH, 'EUR');
    }
    // Default Connector values
    this.chargingStationConnector1 = {
      connectorId: 1,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: new Date().toISOString()
    };
    this.chargingStationConnector2 = {
      connectorId: 2,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: new Date().toISOString()
    };
    // Set meter value start
    this.transactionStartMeterValue = 0;
    this.transactionSignedData = 'DT785uwRY0zBF9ZepmQV94mK08l4ovYHgsraT8Z00l1p7jVRgq';
    this.transactionEndSignedData = 'WZ2eLegGcstPRqYpsu7JQEMZSnUP6XTNzJJfBDKpAYgtXrNQSM';
    this.transactionMeterValues = Array.from({ length: 12 }, () => {
      return faker.random.number({
        min: 200,
        max: 500
      });
    }).concat([0, 0]);
    this.transactionMeterSoCValues = Array.from({ length: 10 }, () => {
      return faker.random.number({
        min: 0,
        max: 90
      });
    }).concat([98, 99, 100, 100]).sort((a, b) => {
      return (a - b);
    });
    this.transactionStartSoC = this.transactionMeterSoCValues[0];
    this.transactionMeterValueIntervalSecs = 60;
    this.transactionStartTime = moment().subtract(this.transactionMeterValues.length * this.transactionMeterValueIntervalSecs + 1, 'seconds');
    this.transactionTotalConsumption = this.transactionMeterValues.reduce((sum, meterValue) => {
      return sum + meterValue;
    });
    this.transactionEndMeterValue = this.transactionStartMeterValue + this.transactionTotalConsumption;
    this.transactionEndSoC = 100;
    this.transactionTotalInactivity = this.transactionMeterValues.reduce(
      (sum, meterValue) => {
        return (meterValue === 0 ? sum + this.transactionMeterValueIntervalSecs : sum);
      }, 0);
    this.totalPrice = this.priceKWH * (this.transactionTotalConsumption / 1000);
  }

  public async after() {
    if (this.currentPricingSetting) {
      await this.centralUserService.settingApi.update(this.currentPricingSetting);
    }
  }

  public async testReadNonExistingTransaction() {
    const response = await this.centralUserService.transactionApi.readById(faker.random.number(100000));
    expect(response.status).to.equal(550);
  }

  public async testReadTransactionWithInvalidId() {
    const response = await this.centralUserService.transactionApi.readById('&é"\'(§è!çà)');
    expect(response.status).to.equal(550);
  }

  public async testReadTransactionWithoutId() {
    const response = await this.centralUserService.transactionApi.readById(null);
    expect(response.status).to.equal(500);
  }

  public async testReadStartedTransactionWithoutMeterValue() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = faker.random.number({ min: 0, max: 1000 });
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.centralUserService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.containSubset({
      id: transactionId,
      timestamp: startDate.toISOString(),
      connectorId: connectorId,
      tagID: tagId,
      chargeBoxID: this.chargingStationContext.getChargingStation().id,
      currentConsumption: 0,
      currentTotalConsumption: 0,
      currentTotalInactivitySecs: 0,
      meterStart: meterStart,
      user: {
        id: this.transactionUser.id,
        firstName: this.transactionUser.firstName,
        name: this.transactionUser.name,
      }
    });
  }

  public async testReadStartedTransactionWithOneMeterValue() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 180;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    const load = 100;
    const currentTime = startDate.clone().add(1, 'hour');
    response = await this.chargingStationContext.sendConsumptionMeterValue(connectorId, transactionId, meterStart + load, currentTime);
    expect(response.data).to.eql({});
    response = await this.centralUserService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.containSubset({
      id: transactionId,
      timestamp: startDate.toISOString(),
      connectorId: connectorId,
      tagID: tagId,
      chargeBoxID: this.chargingStationContext.getChargingStation().id,
      currentConsumption: load,
      currentTotalConsumption: load,
      currentTotalInactivitySecs: 0,
      meterStart: meterStart,
      user: {
        id: this.transactionUser.id,
        firstName: this.transactionUser.firstName,
        name: this.transactionUser.name,
      }
    });
  }

  public async testReadStartedTransactionWithMultipleMeterValues() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 180;
    const startDate = moment();
    const currentTime = startDate.clone();
    let cumulated = meterStart;
    let load = 0;
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    load = 100;
    cumulated += load;
    currentTime.add(1, 'hour');
    response = await this.chargingStationContext.sendConsumptionMeterValue(connectorId, transactionId, cumulated, currentTime);
    expect(response.data).to.eql({});
    load = 50;
    cumulated += load;
    currentTime.add(1, 'hour');
    response = await this.chargingStationContext.sendConsumptionMeterValue(connectorId, transactionId, cumulated, currentTime);
    expect(response.data).to.eql({});
    response = await this.centralUserService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.containSubset({
      id: transactionId,
      currentConsumption: load,
      currentTotalConsumption: cumulated - meterStart,
      currentTotalInactivitySecs: 0,
      meterStart: meterStart,
    });
  }

  public async testReadClosedTransactionWithoutMeterStartAndMeterValues() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 0;
    const meterStop = 0;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.centralUserService.transactionApi.readById(transactionId);
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
  }

  public async testReadClosedTransactionWithDifferentMeterStartAndMeterStop() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.centralUserService.transactionApi.readById(transactionId);
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
  }

  public async testReadNoCompletedTransactions() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 0;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    response = await this.centralUserService.transactionApi.readAllCompleted({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(response.status).to.equal(200);
    expect(response.data.count).to.equal(0);
  }

  public async testReadSomeCompletedTransactionsWithoutStatistics() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId1 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId1, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId2 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId2, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.centralUserService.transactionApi.readAllCompleted({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
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
  }

  public async testReadSomeCompletedTransactionsWithHistoricalStatistics() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId1 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId1, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId2 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId2, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.centralUserService.transactionApi.readAllCompleted({
      ChargeBoxID: this.chargingStationContext.getChargingStation().id,
      Statistics: 'history'
    });
    expect(response.status).to.equal(200);
    expect(response.data.count).to.equal(2);
    expect(response.data.stats).to.containSubset({
      totalConsumptionWattHours: 2000,
      totalDurationSecs: 7200,
      totalPrice: 4,
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
  }

  public async testReadSomeCompletedTransactionsWithRefundStatistics() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId1 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId1, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId2 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId2, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.centralUserService.transactionApi.readAllCompleted({
      UserId: this.transactionUser.id,
      ChargeBoxID: this.chargingStationContext.getChargingStation().id,
      Statistics: 'refund'
    });
    expect(response.status).to.equal(200);
    expect(response.data.count).to.equal(2);
    expect(response.data.stats).to.containSubset({
      totalConsumptionWattHours: 2000,
      totalPriceRefund: 0,
      totalPricePending: 4,
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
  }

  public async testReadNoTransactionsInError() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 0;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    response = await this.centralUserService.transactionApi.readAllInError({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(response.status).to.equal(200);
    expect(response.data.count).to.equal(0);
  }

  public async testReadSomeTransactionsInError() {
    const connectorId = 1;
    const tagId = this.transactionUser.tagIDs[0];
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId1 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId1, tagId, meterStart, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStop, startDate);
    expect(response).to.be.transactionValid;
    const transactionId2 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId2, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.centralUserService.transactionApi.readAllInError({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
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
  }

}
