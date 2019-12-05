import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import faker from 'faker';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';
import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './contextProvider/ChargingStationContext';
import TenantContext from './contextProvider/TenantContext';
import User from '../../src/types/User';
import Utils from './Utils';

chai.use(chaiSubset);
chai.use(responseHelper);

export default class TransactionCommonTests {

  public tenantContext: TenantContext;
  public chargingStationContext: ChargingStationContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public currentPricingSetting;
  public priceKWH = 2;
  public transactionUser: User;
  public transactionUserService: CentralServerService;

  public constructor(tenantContext, centralUserContext) {
    expect(tenantContext).to.exist;
    this.tenantContext = tenantContext;
    this.centralUserContext = centralUserContext;
    expect(centralUserContext).to.exist;
    // Avoid double login for identical user contexts
    const centralAdminUserService = this.tenantContext.getAdminCentralServerService();
    if (this.centralUserContext.email === centralAdminUserService.getAuthenticatedUserEmail()) {
      this.centralUserService = centralAdminUserService;
    } else {
      this.centralUserService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.centralUserContext);
    }
  }

  public setChargingStation(chargingStationContext) {
    expect(chargingStationContext).to.exist;
    this.chargingStationContext = chargingStationContext;
  }

  public setUser(userContext) {
    expect(userContext).to.exist;
    this.transactionUser = userContext;
    // Avoid double login for identical user contexts
    if (this.transactionUser === this.centralUserContext) {
      this.transactionUserService = this.centralUserService;
    } else {
      this.transactionUserService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.transactionUser);
    }
  }

  public async before() {
    const allSettings = await this.centralUserService.settingApi.readAll({});
    this.currentPricingSetting = allSettings.data.result.find((s) => s.identifier === 'pricing');
    if (this.currentPricingSetting) {
      await this.centralUserService.updatePriceSetting(this.priceKWH, 'EUR');
    }
  }

  public async after() {
    if (this.currentPricingSetting) {
      await this.centralUserService.settingApi.update(this.currentPricingSetting);
    }
  }

  public async testReadNonExistingTransaction() {
    const response = await this.transactionUserService.transactionApi.readById(faker.random.number(100000));
    expect(response.status).to.equal(550);
  }

  public async testReadTransactionWithInvalidId() {
    const response = await this.transactionUserService.transactionApi.readById('&é"\'(§è!çà)');
    expect(response.status).to.equal(500);
  }

  public async testReadTransactionWithoutId() {
    const response = await this.transactionUserService.transactionApi.readById(null);
    expect(response.status).to.equal(500);
  }

  public async testReadTransactionOfUser(allowed = true, transactionTag: string) {
    const connectorId = 1;
    const tagId = transactionTag ? transactionTag : this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    const response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;

    const transactionResponse = await this.transactionUserService.transactionApi.readById(response.data.transactionId);
    if (allowed) {
      expect(transactionResponse.status).eq(200);
      expect(transactionResponse.data).not.null;
      expect(transactionResponse.data.tagID).eq(tagId);
    } else {
      expect(transactionResponse.status).eq(560);
      expect(transactionResponse.data).not.null;
      expect(transactionResponse.data.message).eq(`Role Basic is not authorized to perform Read on Transaction '${response.data.transactionId}'`);
    }
  }

  public async testReadStartedTransactionWithoutMeterValue() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = faker.random.number({ min: 0, max: 1000 });
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.transactionUserService.transactionApi.readById(transactionId);
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
      meterStart: meterStart
    });
    if (response.data.user) {
      expect(response.data.user).contain({
        id: this.transactionUser.id,
        firstName: this.transactionUser.firstName,
        name: this.transactionUser.name,
      });
    }
  }

  public async testReadStartedTransactionWithOneMeterValue() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    const load = 100;
    const currentTime = startDate.clone().add(1, 'hour');
    response = await this.chargingStationContext.sendConsumptionMeterValue(connectorId, transactionId, meterStart + load, currentTime);
    expect(response.data).to.eql({});
    response = await this.transactionUserService.transactionApi.readById(transactionId);
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
      meterStart: meterStart
    });
    if (response.data.user) {
      expect(response.data.user).contain({
        id: this.transactionUser.id,
        firstName: this.transactionUser.firstName,
        name: this.transactionUser.name,
      });
    }
  }

  public async testReadStartedTransactionWithMultipleMeterValues() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
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
    response = await this.transactionUserService.transactionApi.readById(transactionId);
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
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 0;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.transactionUserService.transactionApi.readById(transactionId);
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
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.transactionUserService.transactionApi.readById(transactionId);
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
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    response = await this.transactionUserService.transactionApi.readAllCompleted({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(response.status).to.equal(200);
    expect(response.data.count).to.equal(0);
  }

  public async testReadSomeCompletedTransactionsWithoutStatistics() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment().toDate();
    const stopDate = moment(startDate).add(1, 'hour');
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
    response = await this.transactionUserService.transactionApi.readAllCompleted({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
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
    const tagId = this.transactionUser.tags[0].id;
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
    response = await this.transactionUserService.transactionApi.readAllCompleted({
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
    const tagId = this.transactionUser.tags[0].id;
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
    response = await this.transactionUserService.transactionApi.readAllCompleted({
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
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    response = await this.transactionUserService.transactionApi.readAllInError({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(response.status).to.equal(200);
    expect(response.data.count).to.equal(0);
  }

  public async testReadSomeTransactionsInError() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
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
    response = await this.transactionUserService.transactionApi.readAllInError({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
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

  public async testReadConsumptionStartedTransactionWithoutMeterValues() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.transactionUserService.transactionApi.readAllConsumption({ TransactionId: transactionId });
    expect(response.status).to.equal(200);
    expect(response.data).to.containSubset({
      id: transactionId,
      values: []
    });
  }

  public async testReadConsumptionStartedTransactionWithMultipleMeterValues() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    const currentTime = startDate.clone();
    let cumulated = meterStart;
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
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
      response = await this.chargingStationContext.sendConsumptionMeterValue(connectorId, transactionId, cumulated, meterValue.timestamp);
      expect(response.data).to.eql({});
    }
    response = await this.transactionUserService.transactionApi.readAllConsumption({ TransactionId: transactionId });
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
  }

  public async testReadConsumptionStartedTransactionWithDifferentDateParameters() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment('2018-11-06T08:00:00.000Z');
    let cumulated = meterStart;
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
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
      response = await this.chargingStationContext.sendConsumptionMeterValue(connectorId, transactionId, cumulated, meterValue.timestamp);
      expect(response.data).to.eql({});
    }
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
    response = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(2, 'hour').toISOString(),
      EndDateTime: startDate.clone().subtract(1, 'hour').toISOString()
    });
    expect(response.data.values).has.lengthOf(0);
    expect(response.data).to.containSubset({
      id: transactionId,
      values: []
    });
    response = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
      EndDateTime: startDate.clone().subtract(0, 'hour').toISOString()
    });
    expect(response.data.values).has.lengthOf(0);
    expect(response.data).to.containSubset({
      id: transactionId,
      values: []
    });
    response = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(30, 'minutes').toISOString()
    });
    expect(response.data.values).has.lengthOf(0);
    expect(response.data).to.containSubset({
      id: transactionId,
      values: []
    });
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
    response = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().add(2.5, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(3, 'hour').toISOString()
    });
    expect(response.data.values).has.lengthOf(0);
    expect(response.data).to.containSubset({
      id: transactionId,
      values: []
    });
    response = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      EndDateTime: startDate.clone().toISOString()
    });
    expect(response.data.values).has.lengthOf(0);
    expect(response.data).to.containSubset({
      id: transactionId,
      values: []
    });
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
    response = await this.transactionUserService.transactionApi.readAllConsumption({
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
  }

  public async testReadConsumptionStoppedTransactionWithoutMeterValues() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.transactionUserService.transactionApi.readAllConsumption({ TransactionId: transactionId });
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
  }

  public async testReadActiveTransactionsWithoutActiveTransactions() {
    const response = await this.transactionUserService.transactionApi.readAllActive({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(response.status).to.equal(200);
    expect(response.data.count).to.equal(0);
  }

  public async testReadActiveTransactionsWithMultipleActiveTransactions() {
    const connectorId1 = 1;
    const connectorId2 = 2;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId1, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId1 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId1, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.chargingStationContext.startTransaction(connectorId1, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId2 = response.data.transactionId;
    response = await this.chargingStationContext.startTransaction(connectorId2, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId3 = response.data.transactionId;
    response = await this.transactionUserService.transactionApi.readAllActive({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(response.status).to.equal(200);
    expect(response.data.count).to.equal(2);
    expect(response.data.result).to.containSubset([
      {
        id: transactionId2
      }, {
        id: transactionId3
      }
    ]);
  }

  public async testDeleteNotExistingTransaction() {
    const response = await this.transactionUserService.transactionApi.delete(faker.random.number(100000));
    expect(response.status).to.equal(560);
  }

  public async testDeleteTransactionWithInvalidId() {
    const response = await this.transactionUserService.transactionApi.delete('&é"\'(§è!çà)');
    expect(response.status).to.equal(560);
  }

  public async testDeleteTransactionWithoutId() {
    const response = await this.transactionUserService.transactionApi.delete(null);
    expect(response.status).to.equal(560);
  }

  public async testDeleteStartedTransaction(allowed = true) {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.transactionUserService.transactionApi.delete(transactionId);
    if (allowed) {
      expect(response.status).to.equal(200);
    } else {
      expect(response.status).to.equal(560);
    }
    response = await this.transactionUserService.transactionApi.readById(transactionId);
    if (allowed) {
      expect(response.status).to.equal(550);
    } else {
      expect(response.status).to.equal(200);
    }
  }

  public async testDeleteClosedTransaction(allowed = true) {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.transactionUserService.transactionApi.delete(transactionId);
    if (allowed) {
      expect(response.status).to.equal(200);
    } else {
      expect(response.status).to.equal(560);
    }
    response = await this.transactionUserService.transactionApi.readById(transactionId);
    if (allowed) {
      expect(response.status).to.equal(550);
    } else {
      expect(response.status).to.equal(200);
    }
  }

  public async testReadPriceForStoppedTransaction() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
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
      response = await this.chargingStationContext.sendConsumptionMeterValue(connectorId, transactionId, cumulated, meterValue.timestamp);
      expect(response.data).to.eql({});
    }
    response = await this.chargingStationContext.stopTransaction(transactionId, tagId, cumulated, currentDate.add(1, 'hour'));
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.containSubset({
      id: transactionId,
      stop: {
        totalDurationSecs: 7 * 3600,
        totalInactivitySecs: 5 * 3600,
        price: 0.3,
        roundedPrice: 0.3
      }
    });
  }

  public async testReadInactivityForStoppedTransaction() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
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
      response = await this.chargingStationContext.sendConsumptionMeterValue(connectorId, transactionId, cumulated, meterValue.timestamp);
      expect(response.data).to.eql({});
    }
    response = await this.chargingStationContext.stopTransaction(transactionId, tagId, cumulated, currentDate.add(1, 'hour'));
    expect(response).to.be.transactionStatus('Accepted');
    response = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.containSubset({
      id: transactionId,
      stop: {
        totalDurationSecs: 7 * 3600,
        totalInactivitySecs: 5 * 3600
      }
    });

  }

  public async testSendMailNotificationWhenStartingTransaction() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId = response.data.transactionId;
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
      response = await this.chargingStationContext.sendConsumptionMeterValue(connectorId, transactionId, cumulated, meterValue.timestamp);
      expect(response.data).to.eql({});
    }
    await Utils.sleep(1000);
    expect(await this.centralUserService.mailApi.isMailReceived(this.transactionUser.email, 'transaction-started')).is.equal(true, 'transaction-started mail');
    expect(await this.centralUserService.mailApi.isMailReceived(this.transactionUser.email, 'end-of-charge')).is.equal(true, 'end-of-charge mail');
    response = await this.chargingStationContext.stopTransaction(transactionId, tagId, cumulated + 50, currentDate.add(1, 'hour'));
    expect(response).to.be.transactionStatus('Accepted');
  }

  public async testIsAuthorizedOnStartedTransaction(allowed: boolean, canStop?: boolean, canRead?: boolean, transactionTag?: string) {
    const connectorId = 1;
    const tagId = transactionTag ? transactionTag : this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    const response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;

    const isAuthorizedResponse = await this.chargingStationContext.isAuthorized(this.transactionUserService);
    if (allowed) {
      expect(isAuthorizedResponse.status).eq(200);
      expect(isAuthorizedResponse.data).not.null;
      expect(isAuthorizedResponse.data.length).eq(this.chargingStationContext.getChargingStation().connectors.length);
      expect(isAuthorizedResponse.data[0].isStartAuthorized).eq(false);
      expect(isAuthorizedResponse.data[0].isStopAuthorized).eq(canStop);
      expect(isAuthorizedResponse.data[0].isTransactionDisplayAuthorized).eq(canRead);
    } else {
      expect(isAuthorizedResponse.status).eq(560);
    }
  }

  public async testIsAuthorizedToStopTransaction(allowed: boolean, canStop?: boolean, transactionTag?: string) {
    const connectorId = 1;
    const tagId = transactionTag ? transactionTag : this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    const response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;

    const isAuthorizedResponse = await this.chargingStationContext.isAuthorizedToStopTransaction(this.transactionUserService, response.data.transactionId);
    if (allowed) {
      expect(isAuthorizedResponse.status).eq(200);
      expect(isAuthorizedResponse.data).not.null;
      expect(isAuthorizedResponse.data.IsAuthorized).eq(canStop);
    } else {
      expect(isAuthorizedResponse.status).eq(560);
    }
  }

  public async testIsAuthorizedWithoutTransaction(allowed: boolean, canStart?: boolean) {
    const isAuthorizedResponse = await this.chargingStationContext.isAuthorized(this.transactionUserService);
    if (allowed) {
      expect(isAuthorizedResponse.status).eq(200);
      expect(isAuthorizedResponse.data).not.null;
      expect(isAuthorizedResponse.data.length).eq(this.chargingStationContext.getChargingStation().connectors.length);
      for (let i = 0; i < this.chargingStationContext.getChargingStation().connectors.length; i++) {
        expect(isAuthorizedResponse.data[i].isStartAuthorized).eq(canStart);
        expect(isAuthorizedResponse.data[i].isStopAuthorized).eq(false);
        expect(isAuthorizedResponse.data[i].isTransactionDisplayAuthorized).eq(false);
      }
    } else {
      expect(isAuthorizedResponse.status).eq(560);
    }
  }

  public async testSessionsAmountIncreaseByOne(params) {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment().toDate();
    const stopDate = moment(startDate).add(1, 'hour');
    const beforeTransaction = await this.centralUserService.transactionApi.readAllCompleted(params);
    let response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    expect(response).to.be.transactionValid;
    const transactionId1 = response.data.transactionId;
    response = await this.chargingStationContext.stopTransaction(transactionId1, tagId, meterStop, stopDate);
    expect(response).to.be.transactionStatus('Accepted');
    const afterTransaction = await this.centralUserService.transactionApi.readAllCompleted(params);
    expect(afterTransaction.data.count).to.be.eq(beforeTransaction.data.count + 1);
  }

  public async testExportTransactionsToRefund(params) {
    const response = await this.centralUserService.transactionApi.exportTransactionsToRefund(params);
    const transactionsToRefund = await this.centralUserService.transactionApi.readAllToRefund(params);
    const responseFileArray = Utils.convertExportFileToObjectArray(response.data);

    expect(response.status).eq(200);
    expect(response.data).not.null;
    expect(responseFileArray.length).to.be.eql(transactionsToRefund.data.result.length);
  }
}
