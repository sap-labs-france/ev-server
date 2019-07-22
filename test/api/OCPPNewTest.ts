import chai, { expect } from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import responseHelper from '../helpers/responseHelper';
import CentralServerService from './client/CentralServerService';
import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';
import OCPPCommonTestsNew from './OCPPCommonTestsNew';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
  public tenantContext: any;
  public siteContext: any;
  public siteAreaContext: any;
  public chargingStationContext: any;
  public centralUserContext: any;
  public startUserContext: any;
  public stopUserContext: any;
  public ocppCommonTests: OCPPCommonTestsNew;
}

const testData: TestData = new TestData();

describe('OCPP Tests (New)', function() {
  this.timeout(300000); // Will automatically stop the unit test after that period of time

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

  describe('Without activated Organization and Pricing components (tenant ut-nothing)', () => {
  });

  describe('With activated Organization and Pricing components (tenant ut-all)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.siteContext = testData.tenantContext.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
      testData.centralUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
    });

    after(async () => {
    });

    describe('For OCPP Version 1.5 (SOAP)', () => {

      before(async () => {
        testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
      });

      after(async () => {
        await testData.chargingStationContext.cleanUpCreatedData();
      });

      describe('Where basic user is both start and stop user', () => {

        before(async () => {
          testData.startUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          testData.stopUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          testData.ocppCommonTests = new OCPPCommonTestsNew(testData.tenantContext, testData.chargingStationContext, testData.centralUserContext, testData.startUserContext, testData.stopUserContext);

          await testData.ocppCommonTests.before();
        });

        after(async () => {
          await testData.ocppCommonTests.after();
        });

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Charging Station should set both of its connectors to Available', async () => {
          await testData.ocppCommonTests.testConnectorStatus();
        });

        it('Charging Station should send its heartbeat', async () => {
          await testData.ocppCommonTests.testHeartbeat();
        });

        it('Charging Station can change its connector status to Occupied', async () => {
          await testData.ocppCommonTests.testChangeConnectorStatus();
        });

        it('Charging Station should send data transfer', async () => {
          await testData.ocppCommonTests.testDataTransfer();
        });

        it('Charging Station should authorize both start and stop users', async () => {
          await testData.ocppCommonTests.testAuthorizeUsers();
        });

        it('Users should be able to perform a complete regular transaction cycle', async () => {
          await testData.ocppCommonTests.testStartTransaction();
          await testData.ocppCommonTests.testStartSecondTransaction();
          await testData.ocppCommonTests.testSendMeterValues();
          await testData.ocppCommonTests.testStopTransaction();
          await testData.ocppCommonTests.testTransactionMetrics();
          await testData.ocppCommonTests.testDeleteTransaction();
        });

        it('Users can start a transaction which is stopped by StatusNotification', async () => {
          await testData.ocppCommonTests.testConnectorStatusToStopTransaction();
        });

      });

      describe('Where basic user is start user and admin user is stop user', () => {

        before(async () => {
          testData.startUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          testData.stopUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          testData.ocppCommonTests = new OCPPCommonTestsNew(testData.tenantContext, testData.chargingStationContext, testData.centralUserContext, testData.startUserContext, testData.stopUserContext);

          await testData.ocppCommonTests.before();
        });

        after(async () => {
          await testData.ocppCommonTests.after();
        });

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Charging Station should authorize both start and stop users', async () => {
          await testData.ocppCommonTests.testAuthorizeUsers();
        });

        it('Users should be able to perform a complete regular transaction cycle', async () => {
          await testData.ocppCommonTests.testStartTransaction();
          await testData.ocppCommonTests.testStartSecondTransaction();
          await testData.ocppCommonTests.testSendMeterValues();
          await testData.ocppCommonTests.testStopTransaction();
          await testData.ocppCommonTests.testTransactionMetrics();
          await testData.ocppCommonTests.testDeleteTransaction();
        });

        it('Users can start a transaction which is stopped by StatusNotification', async () => {
          await testData.ocppCommonTests.testConnectorStatusToStopTransaction();
        });

      });

    });

    describe('For OCPP Version 1.6 (JSON)', () => {

      before(async () => {
        testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      });

      after(async () => {
        await testData.chargingStationContext.cleanUpCreatedData();
      });

      afterEach(async () => {
        await testData.chargingStationContext.cleanUpCreatedData();
      });

      describe('Where basic user is both start and stop user', () => {

        before(async () => {
          testData.startUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          testData.stopUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          testData.ocppCommonTests = new OCPPCommonTestsNew(testData.tenantContext, testData.chargingStationContext, testData.centralUserContext, testData.startUserContext, testData.stopUserContext);

          await testData.ocppCommonTests.before();
        });

        after(async () => {
          await testData.ocppCommonTests.after();
        });

        it('Charging Station should set both of its connectors to Available', async () => {
          await testData.ocppCommonTests.testConnectorStatus();
        });

        it('Charging Station should send its heartbeat', async () => {
          await testData.ocppCommonTests.testHeartbeat();
        });

        it('Charging Station can change its connector status to Occupied', async () => {
          await testData.ocppCommonTests.testChangeConnectorStatus();
        });

        it('Charging Station should send data transfer', async () => {
          await testData.ocppCommonTests.testDataTransfer();
        });

        it('Charging Station should authorize both start and stop users', async () => {
          await testData.ocppCommonTests.testAuthorizeUsers();
        });

        it('Users should be able to perform a complete regular transaction cycle', async () => {
          //      it('Start User should be able to start a new transaction', async () => {
          await testData.ocppCommonTests.testStartTransaction();
          //      });
          //      it('Start User should be able to start a second time a new transaction', async () => {
          await testData.ocppCommonTests.testStartSecondTransaction();
          //      });
          //      it('Charging Station should send meter values', async () => {
          await testData.ocppCommonTests.testSendMeterValues();
          //      });
          //      it('User should stop the transaction', async () => {
          await testData.ocppCommonTests.testStopTransaction();
          //      });
          //      it('Transaction must have the right consumption metrics and inactivity', async () => {
          await testData.ocppCommonTests.testTransactionMetrics();
          //      });
          //      it('User should delete his transaction', async () => {
          await testData.ocppCommonTests.testDeleteTransaction();
        });

        it('Users should be able to perform a complete transaction cycle with SoC', async () => {
          //      it('Start User should be able to start a new transaction (with SoC)', async () => {
          await testData.ocppCommonTests.testStartTransaction(true);
          //      });
          //      it('Charging Station should send meter values (with SoC)', async () => {
          await testData.ocppCommonTests.testSendMeterValues(true);
          //      });
          //      it('User should stop the transaction (with SoC)', async () => {
          await testData.ocppCommonTests.testStopTransaction(true);
          //      });
          //      it('Transaction must have the right consumption metrics and inactivity (with SoC)', async () => {
          await testData.ocppCommonTests.testTransactionMetrics(true);
          //      });
          //      it('User should delete his transaction (with SoC)', async () => {
          await testData.ocppCommonTests.testDeleteTransaction();
        });

        it('Users should be able to perform a complete transaction cycle with SignedData', async () => {
          //      it('Start User should be able to start a new transaction (with SignedData)', async () => {
          await testData.ocppCommonTests.testStartTransaction();
          //      });
          //      it('Charging Station should send meter values (with SignedData)', async () => {
          await testData.ocppCommonTests.testSendMeterValues(false, true);
          //      });
          //      it('User should stop the transaction (with SignedData)', async () => {
          await testData.ocppCommonTests.testStopTransaction();
          //      });
          //      it('Transaction must have the right consumption metrics and inactivity (with SignedData)', async () => {
          await testData.ocppCommonTests.testTransactionMetrics(false, true);
          //      });
          //      it('User should delete his transaction (with SignedData)', async () => {
          await testData.ocppCommonTests.testDeleteTransaction();
        });

      });

      describe('Where basic user is start user and admin user is stop user', () => {

        before(async () => {
          testData.startUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          testData.stopUserContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          testData.ocppCommonTests = new OCPPCommonTestsNew(testData.tenantContext, testData.chargingStationContext, testData.centralUserContext, testData.startUserContext, testData.stopUserContext);

          await testData.ocppCommonTests.before();
        });

        after(async () => {
          await testData.ocppCommonTests.after();
        });

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Charging Station should authorize both start and stop users', async () => {
          await testData.ocppCommonTests.testAuthorizeUsers();
        });

        it('Users should be able to perform a complete regular transaction cycle', async () => {
          await testData.ocppCommonTests.testStartTransaction();
          await testData.ocppCommonTests.testStartSecondTransaction();
          await testData.ocppCommonTests.testSendMeterValues();
          await testData.ocppCommonTests.testStopTransaction();
          await testData.ocppCommonTests.testTransactionMetrics();
          await testData.ocppCommonTests.testDeleteTransaction();
        });

        it('Users should be able to perform a complete transaction cycle with SoC', async () => {
          await testData.ocppCommonTests.testStartTransaction(true);
          await testData.ocppCommonTests.testSendMeterValues(true);
          await testData.ocppCommonTests.testStopTransaction(true);
          await testData.ocppCommonTests.testTransactionMetrics(true);
          await testData.ocppCommonTests.testDeleteTransaction();
        });

        it('Users should be able to perform a complete transaction cycle with SignedData', async () => {
          await testData.ocppCommonTests.testStartTransaction();
          await testData.ocppCommonTests.testSendMeterValues(false, true);
          await testData.ocppCommonTests.testStopTransaction();
          await testData.ocppCommonTests.testTransactionMetrics(false, true);
          await testData.ocppCommonTests.testDeleteTransaction();
        });

      });

    });

  });

});
