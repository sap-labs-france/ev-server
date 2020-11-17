import Transaction, { InactivityStatus } from '../../src/types/Transaction';
import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import TenantContext from './context/TenantContext';
import TestUtils from './TestUtils';
import { TransactionInErrorType } from '../../src/types/InError';
import User from '../../src/types/User';
import Utils from '../../src/utils/Utils';
import chaiSubset from 'chai-subset';
import faker from 'faker';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

export default class TransactionCommonTests {

  public tenantContext: TenantContext;
  public chargingStationContext: ChargingStationContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public currentPricingSetting;
  public pricekWh = 2;
  public transactionUser;
  public transactionUserService: CentralServerService;

  public constructor(tenantContext: TenantContext, centralUserContext) {
    expect(tenantContext).to.exist;
    this.tenantContext = tenantContext;
    this.centralUserContext = centralUserContext;
    expect(centralUserContext).to.exist;
    // Avoid double login for identical user contexts
    const centralAdminUserService = this.tenantContext.getAdminCentralServerService();
    if (this.centralUserContext.email === centralAdminUserService.getAuthenticatedUserEmail()) {
      this.centralUserService = centralAdminUserService;
    } else {
      this.centralUserService = new CentralServerService(
        this.tenantContext.getTenant().subdomain, this.centralUserContext);
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
      this.transactionUserService = new CentralServerService(
        this.tenantContext.getTenant().subdomain, this.transactionUser);
    }
  }

  public async before() {
    const allSettings = await this.centralUserService.settingApi.readAll({});
    this.currentPricingSetting = allSettings.data.result.find((s) => s.identifier === 'pricing');
    if (this.currentPricingSetting) {
      await this.centralUserService.updatePriceSetting(this.pricekWh, 'EUR');
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
    const response = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(response).to.be.transactionValid;

    const transactionResponse = await this.transactionUserService.transactionApi.readById(response.transactionId);
    if (allowed) {
      expect(transactionResponse.status).eq(200);
      expect(transactionResponse.data).not.null;
      expect(transactionResponse.data.tagID).eq(tagId);
    } else {
      expect(transactionResponse.status).eq(560);
      expect(transactionResponse.data).not.null;
      expect(transactionResponse.data.message).eq(`Role Basic is not authorized to perform Read on Transaction '${response.transactionId}'`);
    }
  }

  public async testReadStartedTransactionWithoutMeterValue() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = faker.random.number({ min: 0, max: 1000 });
    const startDate = moment();
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(200);
    expect(transactionResponse.data).to.containSubset({
      id: transactionId,
      timestamp: startDate.toISOString(),
      connectorId: connectorId,
      tagID: tagId,
      chargeBoxID: this.chargingStationContext.getChargingStation().id,
      currentInstantWatts: 0,
      currentTotalConsumptionWh: 0,
      currentTotalInactivitySecs: 0,
      currentInactivityStatus: InactivityStatus.INFO,
      meterStart: meterStart
    });
    if (transactionResponse.data.user) {
      expect(transactionResponse.data.user).contain({
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const load = 100;
    const currentTime = startDate.clone().add(1, 'hour');
    const meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
      connectorId,
      transactionId,
      currentTime.toDate(),
      { energyActiveImportMeterValue: meterStart + load }
    );
    expect(meterValueResponse).to.eql({});
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(200);
    expect(transactionResponse.data).to.containSubset({
      id: transactionId,
      timestamp: startDate.toISOString(),
      connectorId: connectorId,
      tagID: tagId,
      chargeBoxID: this.chargingStationContext.getChargingStation().id,
      currentInstantWatts: load,
      currentTotalConsumptionWh: load,
      currentTotalInactivitySecs: 0,
      currentInactivityStatus: InactivityStatus.INFO,
      meterStart: meterStart
    });
    if (transactionResponse.data.user) {
      expect(transactionResponse.data.user).contain({
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    load = 100;
    cumulated += load;
    currentTime.add(1, 'hour');
    let meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
      connectorId,
      transactionId,
      currentTime.toDate(),
      { energyActiveImportMeterValue: cumulated }
    );
    expect(meterValueResponse).to.eql({});
    load = 50;
    cumulated += load;
    currentTime.add(1, 'hour');
    meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
      connectorId,
      transactionId,
      currentTime.toDate(),
      { energyActiveImportMeterValue: cumulated }
    );
    expect(meterValueResponse).to.eql({});
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(200);
    expect(transactionResponse.data).to.containSubset({
      id: transactionId,
      currentInstantWatts: load,
      currentTotalConsumptionWh: cumulated - meterStart,
      currentTotalInactivitySecs: 0,
      currentInactivityStatus: InactivityStatus.INFO,
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.data).to.containSubset({
      id: transactionId,
      meterStart: meterStart,
      stop: {
        meterStop: meterStop,
        totalInactivitySecs: 3600,
        inactivityStatus: InactivityStatus.ERROR,
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(200);
    expect(transactionResponse.data).to.containSubset({
      id: transactionId,
      meterStart: meterStart,
      stop: {
        meterStop: meterStop,
        totalConsumptionWh: 1000,
        totalInactivitySecs: 0,
        inactivityStatus: InactivityStatus.INFO,
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactions = await this.transactionUserService.transactionApi.readAllCompleted(
      { ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(transactions.status).to.equal(200);
    expect(transactions.data.count).to.equal(0);
  }

  public async testReadSomeCompletedTransactionsWithoutStatistics() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment().toDate();
    const stopDate = moment(startDate).add(1, 'hour');
    let startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId1 = startTransactionResponse.transactionId;
    let stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId1, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId2 = startTransactionResponse.transactionId;
    stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId2, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactions = await this.transactionUserService.transactionApi.readAllCompleted(
      { ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(transactions.status).to.equal(200);
    expect(transactions.data.count).to.equal(2);
    expect(transactions.data.stats).to.containSubset({ count: 2 });
    expect(transactions.data.result).to.containSubset([{
      id: transactionId1,
      meterStart: meterStart,
      stop: {
        totalConsumptionWh: 1000,
        totalInactivitySecs: 0,
        inactivityStatus: InactivityStatus.INFO,
        meterStop: meterStop,
        timestamp: stopDate.toISOString(),
        tagID: tagId,
      }
    }, {
      id: transactionId2,
      meterStart: meterStart,
      stop: {
        meterStop: meterStop,
        totalConsumptionWh: 1000,
        totalInactivitySecs: 0,
        inactivityStatus: InactivityStatus.INFO,
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
    let startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId1 = startTransactionResponse.transactionId;
    let stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId1, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId2 = startTransactionResponse.transactionId;
    stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId2, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactions = await this.transactionUserService.transactionApi.readAllCompleted({
      ChargeBoxID: this.chargingStationContext.getChargingStation().id,
      Statistics: 'history'
    });
    expect(transactions.status).to.equal(200);
    expect(transactions.data.count).to.equal(2);
    expect(transactions.data.stats).to.containSubset({
      totalConsumptionWattHours: 2000,
      totalDurationSecs: 7200,
      totalPrice: 4,
      totalInactivitySecs: 0,
      count: 2
    }
    );
    expect(transactions.data.result).to.containSubset([{
      id: transactionId1,
      meterStart: meterStart,
      stop: {
        totalConsumptionWh: 1000,
        totalInactivitySecs: 0,
        inactivityStatus: InactivityStatus.INFO,
        meterStop: meterStop,
        timestamp: stopDate.toISOString(),
        tagID: tagId,
      }
    }, {
      id: transactionId2,
      meterStart: meterStart,
      stop: {
        meterStop: meterStop,
        totalConsumptionWh: 1000,
        totalInactivitySecs: 0,
        inactivityStatus: InactivityStatus.INFO,
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
    let startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId1 = startTransactionResponse.transactionId;
    let stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId1, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId2 = startTransactionResponse.transactionId;
    stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId2, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactions = await this.transactionUserService.transactionApi.readAllCompleted({
      UserId: this.transactionUser.id,
      ChargeBoxID: this.chargingStationContext.getChargingStation().id,
      Statistics: 'refund'
    });
    expect(transactions.status).to.equal(200);
    expect(transactions.data.count).to.equal(2);
    expect(transactions.data.stats).to.containSubset({
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
    expect(transactions.data.result).to.containSubset([{
      id: transactionId1,
      meterStart: meterStart,
      stop: {
        totalConsumptionWh: 1000,
        totalInactivitySecs: 0,
        inactivityStatus: InactivityStatus.INFO,
        meterStop: meterStop,
        timestamp: stopDate.toISOString(),
        tagID: tagId,
      }
    }, {
      id: transactionId2,
      meterStart: meterStart,
      stop: {
        meterStop: meterStop,
        totalConsumptionWh: 1000,
        totalInactivitySecs: 0,
        inactivityStatus: InactivityStatus.INFO,
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactions = await this.transactionUserService.transactionApi.readAllInError(
      { ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(transactions.status).to.equal(200);
    expect(transactions.data.count).to.equal(0);
  }

  public async testReadSomeTransactionsInError() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId1 = startTransactionResponse.transactionId;
    let stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId1, tagId, meterStart, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStop, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId2 = startTransactionResponse.transactionId;
    stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId2, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactions = await this.transactionUserService.transactionApi.readAllInError(
      { ChargeBoxID: this.chargingStationContext.getChargingStation().id, ErrorType: TransactionInErrorType.NO_CONSUMPTION });
    expect(transactions.status).to.equal(200);
    expect(transactions.data.count).to.equal(2);
    expect(transactions.data.result).to.containSubset([{
      id: transactionId1,
      meterStart: meterStart,
    }]);
  }

  public async testReadConsumptionStartedTransactionWithoutMeterValues() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const startDate = moment();
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const consumptions = await this.transactionUserService.transactionApi.readAllConsumption(
      { TransactionId: transactionId });
    expect(consumptions.status).to.equal(200);
    expect(consumptions.data).to.containSubset({
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
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
      const meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
        connectorId,
        transactionId,
        meterValue.timestamp.toDate(),
        { energyActiveImportMeterValue: cumulated }
      );
      expect(meterValueResponse).to.eql({});
    }
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(200);
    const transaction = transactionResponse.data as Transaction;
    const consumptions = await this.transactionUserService.transactionApi.readAllConsumption(
      { TransactionId: transactionId });
    expect(consumptions.status).to.equal(200);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: transaction.timestamp,
          startedAt: transaction.timestamp,
          instantWatts: meterValues[0].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
          cumulatedConsumptionWh: meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        },
        {
          date: meterValues[0].timestamp.toISOString(),
          startedAt: meterValues[0].timestamp.toISOString(),
          instantWatts: meterValues[1].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value),
          cumulatedConsumptionWh: cumulated - meterStart,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, cumulated - meterStart),
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
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
      const meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
        connectorId,
        transactionId,
        meterValue.timestamp.toDate(),
        { energyActiveImportMeterValue: cumulated }
      );
      expect(meterValueResponse).to.eql({});
    }
    let consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(1, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(2);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[0].timestamp.toISOString(),
          startedAt: meterValues[0].timestamp.toISOString(),
          instantWatts: meterValues[0].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
          cumulatedConsumptionWh: meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        },
        {
          date: meterValues[1].timestamp.toISOString(),
          startedAt: meterValues[1].timestamp.toISOString(),
          instantWatts: meterValues[1].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value),
          cumulatedConsumptionWh: cumulated - meterStart,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, cumulated - meterStart),
        }
      ]
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(2, 'hour').toISOString(),
      EndDateTime: startDate.clone().subtract(1, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(0);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: []
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
      EndDateTime: startDate.clone().subtract(0, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(0);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: []
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(30, 'minutes').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(0);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: []
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(1, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(1);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[0].timestamp.toISOString(),
          startedDate: meterValues[0].timestamp.toISOString(),
          instantWatts: meterValues[0].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
          cumulatedConsumptionWh: meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        }
      ]
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(1.5, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(1);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[0].timestamp.toISOString(),
          startedDate: meterValues[0].timestamp.toISOString(),
          instantWatts: meterValues[0].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
          cumulatedConsumptionWh: meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        }
      ]
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().subtract(1, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(3, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(2);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[0].timestamp.toISOString(),
          startedDate: meterValues[0].timestamp.toISOString(),
          instantWatts: meterValues[0].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
          cumulatedConsumptionWh: meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        },
        {
          date: meterValues[1].timestamp.toISOString(),
          startedDate: meterValues[1].timestamp.toISOString(),
          instantWatts: meterValues[1].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value),
          cumulatedConsumptionWh: meterValues[1].value + meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value + meterValues[0].value),
        }
      ]
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().add(1, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(2, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(2);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[0].timestamp.toISOString(),
          startedDate: meterValues[0].timestamp.toISOString(),
          instantWatts: meterValues[0].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
          cumulatedConsumptionWh: meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        },
        {
          date: meterValues[1].timestamp.toISOString(),
          startedDate: meterValues[1].timestamp.toISOString(),
          instantWatts: meterValues[1].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value),
          cumulatedConsumptionWh: meterValues[1].value + meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value + meterValues[0].value),
        }
      ]
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().add(1.5, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(2, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(1);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[1].timestamp.toISOString(),
          startedDate: meterValues[1].timestamp.toISOString(),
          instantWatts: meterValues[1].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value),
          cumulatedConsumptionWh: meterValues[1].value + meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        }
      ]
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().add(2, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(3, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(1);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[1].timestamp.toISOString(),
          startedDate: meterValues[1].timestamp.toISOString(),
          instantWatts: meterValues[1].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value),
          cumulatedConsumptionWh: meterValues[1].value + meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value + meterValues[0].value),
        }
      ]
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      StartDateTime: startDate.clone().add(2.5, 'hour').toISOString(),
      EndDateTime: startDate.clone().add(3, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(0);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: []
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      EndDateTime: startDate.clone().toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(0);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: []
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      EndDateTime: startDate.clone().add(1, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(1);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[0].timestamp.toISOString(),
          startedDate: meterValues[0].timestamp.toISOString(),
          instantWatts: meterValues[0].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
          cumulatedConsumptionWh: meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        }
      ]
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      EndDateTime: startDate.clone().add(2.5, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(2);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[0].timestamp.toISOString(),
          startedDate: meterValues[0].timestamp.toISOString(),
          instantWatts: meterValues[0].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
          cumulatedConsumptionWh: meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        },
        {
          date: meterValues[1].timestamp.toISOString(),
          startedDate: meterValues[1].timestamp.toISOString(),
          instantWatts: meterValues[1].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value),
          cumulatedConsumptionWh: meterValues[1].value + meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value + meterValues[0].value),
        }
      ]
    });
    consumptions = await this.transactionUserService.transactionApi.readAllConsumption({
      TransactionId: transactionId,
      EndDateTime: startDate.clone().add(4, 'hour').toISOString()
    });
    expect(consumptions.data.values).has.lengthOf(2);
    expect(consumptions.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: meterValues[0].timestamp.toISOString(),
          startedDate: meterValues[0].timestamp.toISOString(),
          instantWatts: meterValues[0].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
          cumulatedConsumptionWh: meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[0].value),
        },
        {
          date: meterValues[1].timestamp.toISOString(),
          startedDate: meterValues[1].timestamp.toISOString(),
          instantWatts: meterValues[1].value,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value),
          cumulatedConsumptionWh: meterValues[1].value + meterValues[0].value,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterValues[1].value + meterValues[0].value),
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const consumption = await this.transactionUserService.transactionApi.readAllConsumption({ TransactionId: transactionId });
    expect(consumption.status).to.equal(200);
    expect(consumption.data).to.containSubset({
      id: transactionId,
      values: [
        {
          date: startDate.toISOString(),
          startedAt: startDate.toISOString(),
          endedAt: stopDate.toISOString(),
          instantWatts: meterStop - meterStart,
          instantAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterStop - meterStart),
          cumulatedConsumptionWh: meterStop,
          cumulatedConsumptionAmps: Utils.convertWattToAmp(
            this.chargingStationContext.getChargingStation(), null, connectorId, meterStop),
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
    let startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId1, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId1 = startTransactionResponse.transactionId;
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId1, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId1, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId2 = startTransactionResponse.transactionId;
    startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId2, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId3 = startTransactionResponse.transactionId;
    const transactions = await this.transactionUserService.transactionApi.readAllActive({ ChargeBoxID: this.chargingStationContext.getChargingStation().id });
    expect(transactions.status).to.equal(200);
    expect(transactions.data.count).to.equal(2);
    expect(transactions.data.result).to.containSubset([
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const transactionDeleted = await this.transactionUserService.transactionApi.delete(transactionId);
    if (allowed) {
      expect(transactionDeleted.status).to.equal(200);
    } else {
      expect(transactionDeleted.status).to.equal(560);
    }
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    if (allowed) {
      expect(transactionResponse.status).to.equal(550);
    } else {
      expect(transactionResponse.status).to.equal(200);
    }
  }

  public async testDeleteClosedTransaction(allowed = true) {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactionDeleted = await this.transactionUserService.transactionApi.delete(transactionId);
    if (allowed) {
      expect(transactionDeleted.status).to.equal(200);
    } else {
      expect(transactionDeleted.status).to.equal(560);
    }
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    if (allowed) {
      expect(transactionResponse.status).to.equal(550);
    } else {
      expect(transactionResponse.status).to.equal(200);
    }
  }

  public async testMultiDeleteNotFoundTransactions() {
    const response = await this.transactionUserService.transactionApi.deleteMany([faker.random.number(100000), faker.random.number(100000)]);
    expect(response.status).to.equal(200);
    expect(response.data.inSuccess).to.equal(0);
    expect(response.data.inError).to.equal(2);
  }

  public async testMultiDeleteTransactions(allowed = true) {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactionsDeleted = await this.transactionUserService.transactionApi.deleteMany([transactionId, faker.random.number(100000)]);
    if (allowed) {
      expect(transactionsDeleted.status).to.equal(200);
      expect(transactionsDeleted.data.inSuccess).to.equal(1);
      expect(transactionsDeleted.data.inError).to.equal(1);
    } else {
      expect(transactionsDeleted.status).to.equal(560);
    }
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    if (allowed) {
      expect(transactionResponse.status).to.equal(550);
    } else {
      expect(transactionResponse.status).to.equal(200);
    }
  }

  public async testMultiDeleteValidTransactions() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment();
    const stopDate = startDate.clone().add(1, 'hour');
    let startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const secondTransactionId = startTransactionResponse.transactionId;
    const transactionsDeleted = await this.transactionUserService.transactionApi.deleteMany([transactionId, secondTransactionId]);
    expect(transactionsDeleted.status).to.equal(200);
    expect(transactionsDeleted.data.inSuccess).to.equal(2);
    expect(transactionsDeleted.data.inError).to.equal(0);
    let transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(550);
    transactionResponse = await this.transactionUserService.transactionApi.readById(secondTransactionId);
    expect(transactionResponse.status).to.equal(550);

  }

  public async testReadPriceForStoppedTransaction() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
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
      const meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
        connectorId,
        transactionId,
        meterValue.timestamp.toDate(),
        { energyActiveImportMeterValue : cumulated }
      );
      expect(meterValueResponse).to.eql({});
    }
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, cumulated, currentDate.add(1, 'hour').toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(200);
    expect(transactionResponse.data).to.containSubset({
      id: transactionId,
      stop: {
        totalDurationSecs: 7 * 3600,
        totalInactivitySecs: 5 * 3600,
        inactivityStatus: InactivityStatus.ERROR,
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
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
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
      const meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
        connectorId,
        transactionId,
        meterValue.timestamp.toDate(),
        { energyActiveImportMeterValue : cumulated }
      );
      expect(meterValueResponse).to.eql({});
    }
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId, tagId, cumulated, currentDate.add(1, 'hour').toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactionResponse = await this.transactionUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(200);
    expect(transactionResponse.data).to.containSubset({
      id: transactionId,
      stop: {
        totalDurationSecs: 7 * 3600,
        totalInactivitySecs: 5 * 3600,
        inactivityStatus: InactivityStatus.ERROR
      }
    });

  }

  public async testSendMailNotificationWhenStartingTransaction() {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
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
      const meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
        connectorId,
        transactionId,
        meterValue.timestamp.toDate(),
        { energyActiveImportMeterValue : cumulated }
      );
      expect(meterValueResponse).to.eql({});
    }
    await TestUtils.sleep(1000);
    expect(await this.centralUserService.mailApi.isMailReceived(this.transactionUser.email, 'transaction-started')).is.equal(true, 'transaction-started mail');
    expect(await this.centralUserService.mailApi.isMailReceived(this.transactionUser.email, 'end-of-charge')).is.equal(true, 'end-of-charge mail');
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, tagId, cumulated + 50, currentDate.add(1, 'hour').toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
  }

  public async testIsAuthorizedOnStartedTransaction(allowed: boolean, canStop?: boolean, canRead?: boolean, transactionTag?: string) {
    const connectorId = 1;
    const tagId = transactionTag ? transactionTag : this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    const response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(response).to.be.transactionValid;
  }

  public async testIsAuthorizedToStopTransaction(allowed: boolean, canStop?: boolean, transactionTag?: string) {
    const connectorId = 1;
    const tagId = transactionTag ? transactionTag : this.transactionUser.tags[0].id;
    const meterStart = 180;
    const startDate = moment();
    const response = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate.toDate());
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(response).to.be.transactionValid;
  }

  public async testSessionsAmountIncreaseByOne(params) {
    const connectorId = 1;
    const tagId = this.transactionUser.tags[0].id;
    const meterStart = 0;
    const meterStop = 1000;
    const startDate = moment().toDate();
    const stopDate = moment(startDate).add(1, 'hour');
    const transactionCompletedBeforeResponse = await this.centralUserService.transactionApi.readAllCompleted(params);
    const startTransactionResponse = await this.chargingStationContext.startTransaction(connectorId, tagId, meterStart, startDate);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId1 = startTransactionResponse.transactionId;
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId1, tagId, meterStop, stopDate.toDate());
    expect(stopTransactionResponse).to.be.transactionStatus('Accepted');
    const transactionCompletedAfterResponse = await this.centralUserService.transactionApi.readAllCompleted(params);
    expect(transactionCompletedAfterResponse.data.count).to.be.eq(transactionCompletedBeforeResponse.data.count + 1);
  }

  public async testExportTransactionsToRefund(params) {
    const response = await this.centralUserService.transactionApi.exportTransactionsToRefund(params);
    const transactionsToRefund = await this.centralUserService.transactionApi.readAllToRefund(params);
    const responseFileArray = TestUtils.convertExportFileToObjectArray(response.data);

    expect(response.status).eq(200);
    expect(response.data).not.null;
    expect(responseFileArray.length).to.be.eql(transactionsToRefund.data.result.length);
  }
}
