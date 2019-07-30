import chai, { expect } from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import responseHelper from '../helpers/responseHelper';
import CentralServerService from './client/CentralServerService';
import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';
import TransactionCommonTests from './TransactionCommonTests';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
  public tenantContext: any;
  public centralUserContext: any;
  public transactionCommonTests: TransactionCommonTests;
  public siteContext: any;
  public siteAreaContext: any;
  public chargingStationContext: any;
}

const testData: TestData = new TestData();

describe('Transaction tests (new)', function () {
  this.timeout(1000000); // Will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.DefaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  after(async () => {
    // Final clean up at the end
    await ContextProvider.DefaultInstance.cleanUpCreatedContent();
  });

  describe('With components Organization and Pricing (tenant ut-all)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.centralUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.transactionCommonTests = new TransactionCommonTests(testData.tenantContext, testData.centralUserContext);
      // Do not use the same site as used for creating test data in the context builder!
      testData.siteContext = testData.tenantContext.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);

      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      testData.transactionCommonTests.setChargingStation(testData.chargingStationContext);
      await testData.transactionCommonTests.before();
    });

    after(async () => {
      await testData.transactionCommonTests.after();
    });

    describe('Where basic user', () => {

      before(() => {
        testData.transactionCommonTests.setUser(
          testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER)
        );
      });

      afterEach(async () => {
        await testData.chargingStationContext.cleanUpCreatedData();
      });

      describe('Using method readById', () => {

        it('Cannot read a not existing transaction', async () => {
          await testData.transactionCommonTests.testReadNonExistingTransaction();
        });

        it('Cannot read a transaction with invalid id', async () => {
          await testData.transactionCommonTests.testReadTransactionWithInvalidId();
        });

        it('Cannot read a transaction without providing id', async () => {
          await testData.transactionCommonTests.testReadTransactionWithoutId();
        });

        it('Can read a started transaction', async () => {
          await testData.transactionCommonTests.testReadStartedTransactionWithoutMeterValue();
        });

        it('Can read a started transaction with one meter value', async () => {
          await testData.transactionCommonTests.testReadStartedTransactionWithOneMeterValue();
        });

        it('Can read a started transaction with multiple meter values', async () => {
          await testData.transactionCommonTests.testReadStartedTransactionWithMultipleMeterValues();
        });

        it('Can read a closed transaction without meter values and no meterStart', async () => {
          await testData.transactionCommonTests.testReadClosedTransactionWithoutMeterStartAndMeterValues();
        });

        it('Can read a closed transaction without meter values and a meterStart different from meterStop', async () => {
          await testData.transactionCommonTests.testReadClosedTransactionWithDifferentMeterStartAndMeterStop();
        });

      });

      describe('Using method readAllCompleted', () => {

        it('Cannot find any completed transactions if all transactions are still running', async () => {
          await testData.transactionCommonTests.testReadNoCompletedTransactions();
        });

        it('Can read some completed transactions without statistics', async () => {
          await testData.transactionCommonTests.testReadSomeCompletedTransactionsWithoutStatistics();
        });

        it('Can read some completed transactions with historical statistics', async () => {
          await testData.transactionCommonTests.testReadSomeCompletedTransactionsWithHistoricalStatistics();
        });

        it('Can read some completed transactions completed with refund statistics', async () => {
          await testData.transactionCommonTests.testReadSomeCompletedTransactionsWithRefundStatistics();
        });

      });

      describe('Using method readAllInError', () => {

        it('Cannot find any transactions in error if all transactions are still running', async () => {
          await testData.transactionCommonTests.testReadNoTransactionsInError();
        });

        it('Can find some transactions in error', async () => {
          await testData.transactionCommonTests.testReadSomeTransactionsInError();
        });

      });

    });

  });

});
