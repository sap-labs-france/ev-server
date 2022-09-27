import ChargingStationContext from './context/ChargingStationContext';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import TransactionCommonTests from './TransactionCommonTests';
import chai from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import { faker } from '@faker-js/faker';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
  public tenantContext: any;
  public centralUserContext: any;
  public transactionCommonTests: TransactionCommonTests;
  public siteContext: any;
  public siteAreaContext: any;
  public chargingStationContext: ChargingStationContext;
}

const testData: TestData = new TestData();

describe('Transaction', () => {
  jest.setTimeout(1000000); // Will automatically stop the unit test after that period of time

  beforeAll(async () => {
    chai.config.includeStack = true;
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  afterAll(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('With components Organization and Pricing (utall)', () => {

    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.transactionCommonTests = new TransactionCommonTests(testData.tenantContext, testData.centralUserContext);
      // Do not use the same site as used for creating test data in the context builder!
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);

      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      testData.transactionCommonTests.setChargingStation(testData.chargingStationContext);
    });

    afterAll(async () => {
      await testData.transactionCommonTests.after();
      await testData.chargingStationContext.cleanUpCreatedData();
    });

    describe('Where basic user', () => {

      beforeAll(() => {
        testData.transactionCommonTests.setUser(
          testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER)
        );
      });

      describe('Using function "readById"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Should be authorized on a started transaction by itself', async () => {
          await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, true, true);
        });

        it(
          'Should not be authorized on a transaction started by another',
          async () => {
            const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
            await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, false, false, anotherUser.tags[0].id);
          }
        );

        it(
          'Should be authorized to stop a transaction started by itself',
          async () => {
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, true);
          }
        );

        it(
          'Should not be authorized to stop a transaction started by another',
          async () => {
            const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, false, anotherUser.tags[0].id);
          }
        );

        it('Cannot read a not existing transaction', async () => {
          await testData.transactionCommonTests.testReadNonExistingTransaction();
        });

        it('Cannot read a transaction with invalid id', async () => {
          await testData.transactionCommonTests.testReadTransactionWithInvalidId();
        });

        it('Cannot read a transaction without providing id', async () => {
          await testData.transactionCommonTests.testReadTransactionWithoutId();
        });

        it('Cannot read a transaction of another user', async () => {
          const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          await testData.transactionCommonTests.testReadTransactionOfUser(false, anotherUser.tags[0].id);
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

        it(
          'Can read a closed transaction without meter values and no meterStart',
          async () => {
            await testData.transactionCommonTests.testReadClosedTransactionWithoutMeterStartAndMeterValues();
          }
        );

        it(
          'Can read a closed transaction without meter values and a meterStart different from meterStop',
          async () => {
            await testData.transactionCommonTests.testReadClosedTransactionWithDifferentMeterStartAndMeterStop();
          }
        );

      });

      describe('Using function "readAllCompleted"', () => {

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it(
          'Cannot find any completed transactions if all transactions are still running',
          async () => {
            await testData.transactionCommonTests.testReadNoCompletedTransactions();
          }
        );

        it('Can read some completed transactions without statistics', async () => {
          await testData.transactionCommonTests.testReadSomeCompletedTransactionsWithoutStatistics();
        });

        it(
          'Can read some completed transactions with historical statistics',
          async () => {
            await testData.transactionCommonTests.testReadSomeCompletedTransactionsWithHistoricalStatistics();
          }
        );

        it(
          'Can read some completed transactions completed with refund statistics',
          async () => {
            await testData.transactionCommonTests.testReadSomeCompletedTransactionsWithRefundStatistics();
          }
        );

        it(
          'Should increase sessions count by only one after a completed session',
          async () => {
            await testData.transactionCommonTests.testSessionsAmountIncreaseByOne({});
          }
        );

      });

      describe('Using function "readAllConsumption"', () => {

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it(
          'Can read consumption of a started transaction without meter values',
          async () => {
            await testData.transactionCommonTests.testReadConsumptionStartedTransactionWithoutMeterValues();
          }
        );

        it(
          'Can read consumption of a started transaction with multiple meter values',
          async () => {
            await testData.transactionCommonTests.testReadConsumptionStartedTransactionWithMultipleMeterValues();
          }
        );

        it(
          'Can read consumption of a stopped transaction without meter values',
          async () => {
            await testData.transactionCommonTests.testReadConsumptionStoppedTransactionWithoutMeterValues();
          }
        );

      });

      describe('Using function "getTransactionsActive"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Can read on a charger without active transactions', async () => {
          await testData.transactionCommonTests.testReadActiveTransactionsWithoutActiveTransactions();
        });

        it('Can read on a charger with multiple active transactions', async () => {
          await testData.transactionCommonTests.testReadActiveTransactionsWithMultipleActiveTransactions();
        });

      });
      describe('Using function "deleteMany"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Cannot delete multi transactions with a basic user', async () => {
          await testData.transactionCommonTests.testMultiDeleteExistingTransactions(false);
        });
      });
      describe('Using function "delete"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Cannot delete a not existing transaction', async () => {
          await testData.transactionCommonTests.testDeleteNotExistingTransaction();
        });

        it('Cannot delete a transaction with invalid id', async () => {
          await testData.transactionCommonTests.testDeleteTransactionWithInvalidId();
        });

        it('Cannot delete a transaction without providing id', async () => {
          await testData.transactionCommonTests.testDeleteTransactionWithoutId();
        });

        it('Cannot delete a started transaction', async () => {
          await testData.transactionCommonTests.testDeleteStartedTransaction(false);
        });

        it('Cannot delete a closed transaction', async () => {
          await testData.transactionCommonTests.testDeleteClosedTransaction(false);
        });

      });

      describe('Using other functionalities', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Should read correct price in a stopped transaction', async () => {
          await testData.transactionCommonTests.testReadPriceForStoppedTransaction();
        });

        it('Should read correct inactivity in a stopped transaction', async () => {
          await testData.transactionCommonTests.testReadInactivityForStoppedTransaction();
        });

        xit('Should receive a mail notification when starting a transaction', async () => {
          await testData.transactionCommonTests.testSendMailNotificationWhenStartingTransaction();
        });

      });

    });

    describe('Where admin user', () => {

      beforeAll(() => {
        testData.transactionCommonTests.setUser(
          testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN)
        );
      });

      describe('Using function "readById"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Should be authorized on a started transaction by itself', async () => {
          await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, true, true);
        });

        it('Should be authorized on a transaction started by another', async () => {
          const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, true, true, anotherUser.tags[0].id);
        });

        it(
          'Should be authorized to stop a transaction started by itself',
          async () => {
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, true);
          }
        );

        it(
          'Should be authorized to stop a transaction started by another',
          async () => {
            const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, true, anotherUser.tags[0].id);
          }
        );

        it('Can read a transaction of another user', async () => {
          const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          await testData.transactionCommonTests.testReadTransactionOfUser(true, anotherUser.tags[0].id);
        });
      });

      describe('Using function "readAllInError"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it(
          'Cannot find any transactions in error if all transactions are still running',
          async () => {
            await testData.transactionCommonTests.testReadNoTransactionsInError();
          }
        );

        it('Can find some transactions in error', async () => {
          await testData.transactionCommonTests.testReadSomeTransactionsInError();
        });

      });

      describe('Using function "readAllCompleted"', () => {
        it(
          'Should increase sessions count by only one after a completed session',
          async () => {
            await testData.transactionCommonTests.testSessionsAmountIncreaseByOne({ OnlyRecordCount: true });
          }
        );
      });
      describe('Using function "deleteMany"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });
        it('Can delete only existent transactions', async () => {
          await testData.transactionCommonTests.testMultiDeleteExistingTransactions();
        });
        it('Can delete multi valid transactions', async () => {
          await testData.transactionCommonTests.testMultiDeleteValidTransactions();
        });
        it('Cannot delete non-existent transactions', async () => {
          await testData.transactionCommonTests.testMultiDeleteNotFoundTransactions();
        });
      });
      describe('Using function "delete"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Can delete a started transaction', async () => {
          await testData.transactionCommonTests.testDeleteStartedTransaction();
        });

        it('Can delete a closed transaction', async () => {
          await testData.transactionCommonTests.testDeleteClosedTransaction();
        });

      });

      it(
        'Should be able to export transactions to refund data to a file',
        async () => {
          await testData.transactionCommonTests.testExportTransactionsToRefund({});
        }
      );

    });

  });

  describe('With component Organization without ACL (utorg)', () => {

    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.transactionCommonTests = new TransactionCommonTests(testData.tenantContext, testData.centralUserContext);
      // Do not use the same site as used for creating test data in the context builder!
      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHORIZATION);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITHOUT_ACL);

      testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      testData.transactionCommonTests.setChargingStation(testData.chargingStationContext);
    });

    afterAll(async () => {
      await testData.transactionCommonTests.after();
      await testData.chargingStationContext.cleanUpCreatedData();
    });

    describe('Where basic user', () => {

      beforeAll(() => {
        testData.transactionCommonTests.setUser(
          testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER)
        );
      });

      describe('Using function "readById"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });


        it('Should be authorized on a started transaction by itself', async () => {
          await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, true, true);
        });

        it(
          'Should not be authorized on a transaction started by unknown user',
          async () => {
            await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, false, false, faker.random.alphaNumeric(8));
          }
        );

        it(
          'Should be authorized to stop a transaction started by itself',
          async () => {
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, true);
          }
        );

        it(
          'Should not be authorized to stop a transaction started by another user',
          async () => {
            const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, false, anotherUser.tags[0].id);
          }
        );

        it(
          'Should not be authorized to stop a transaction started by unknown user',
          async () => {
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, false, faker.random.alphaNumeric(8));
          }
        );

        it('Cannot read a not existing transaction', async () => {
          await testData.transactionCommonTests.testReadNonExistingTransaction();
        });

        it('Cannot read a transaction with invalid id', async () => {
          await testData.transactionCommonTests.testReadTransactionWithInvalidId();
        });

        it('Cannot read a transaction without providing id', async () => {
          await testData.transactionCommonTests.testReadTransactionWithoutId();
        });

        it('Cannot read a transaction of another user', async () => {
          const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          await testData.transactionCommonTests.testReadTransactionOfUser(false, anotherUser.tags[0].id);
        });

        it('Cannot read a transaction of unknown user', async () => {
          await testData.transactionCommonTests.testReadTransactionOfUser(false, faker.random.alphaNumeric(8));
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

        it(
          'Can read a closed transaction without meter values and no meterStart',
          async () => {
            await testData.transactionCommonTests.testReadClosedTransactionWithoutMeterStartAndMeterValues();
          }
        );

        it(
          'Can read a closed transaction without meter values and a meterStart different from meterStop',
          async () => {
            await testData.transactionCommonTests.testReadClosedTransactionWithDifferentMeterStartAndMeterStop();
          }
        );

      });

      describe('Using function "delete"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Cannot delete a not existing transaction', async () => {
          await testData.transactionCommonTests.testDeleteNotExistingTransaction();
        });

        it('Cannot delete a transaction with invalid id', async () => {
          await testData.transactionCommonTests.testDeleteTransactionWithInvalidId();
        });

        it('Cannot delete a transaction without providing id', async () => {
          await testData.transactionCommonTests.testDeleteTransactionWithoutId();
        });

        it('Cannot delete a started transaction', async () => {
          await testData.transactionCommonTests.testDeleteStartedTransaction(false);
        });

        it('Cannot delete a closed transaction', async () => {
          await testData.transactionCommonTests.testDeleteClosedTransaction(false);
        });

      });
    });

    describe('Where admin user', () => {

      beforeAll(() => {
        testData.transactionCommonTests.setUser(
          testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN)
        );
      });

      describe('Using function "readById"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Should be authorized on a started transaction by itself', async () => {
          await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, true, true);
        });

        it('Should be authorized on a transaction started by another', async () => {
          const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, true, true, anotherUser.tags[0].id);
        });

        it(
          'Should be authorized to stop a transaction started by itself',
          async () => {
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, true);
          }
        );

        it(
          'Should be authorized to stop a transaction started by another',
          async () => {
            const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, true, anotherUser.tags[0].id);
          }
        );

        it('Can read a transaction of another user', async () => {
          const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          await testData.transactionCommonTests.testReadTransactionOfUser(true, anotherUser.tags[0].id);
        });
      });

      describe('Using function "readAllInError"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it(
          'Cannot find any transactions in error if all transactions are still running',
          async () => {
            await testData.transactionCommonTests.testReadNoTransactionsInError();
          }
        );

        it('Can find some transactions in error', async () => {
          await testData.transactionCommonTests.testReadSomeTransactionsInError();
        });

      });

      describe('Using function "delete"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Can delete a started transaction', async () => {
          await testData.transactionCommonTests.testDeleteStartedTransaction();
        });

        it('Can delete a closed transaction', async () => {
          await testData.transactionCommonTests.testDeleteClosedTransaction();
        });

      });

    });

  });

  describe('Without any component (utnothing)', () => {

    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.transactionCommonTests = new TransactionCommonTests(testData.tenantContext, testData.centralUserContext);

      testData.chargingStationContext = testData.tenantContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
      testData.transactionCommonTests.setChargingStation(testData.chargingStationContext);
    });

    afterAll(async () => {
      await testData.transactionCommonTests.after();
      await testData.chargingStationContext.cleanUpCreatedData();
    });

    describe('Where basic user', () => {

      beforeAll(() => {
        testData.transactionCommonTests.setUser(
          testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER)
        );
      });

      describe('Using function "readById"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Should be authorized on a started transaction by itself', async () => {
          await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, true, true);
        });

        it(
          'Should not be authorized on a transaction started by another',
          async () => {
            const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
            await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, false, false, anotherUser.tags[0].id);
          }
        );

        it(
          'Should be authorized to stop a transaction started by itself',
          async () => {
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, true);
          }
        );

        it(
          'Should not be authorized to stop a transaction started by another',
          async () => {
            const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, false, anotherUser.tags[0].id);
          }
        );

        it('Cannot read a not existing transaction', async () => {
          await testData.transactionCommonTests.testReadNonExistingTransaction();
        });

        it('Cannot read a transaction with invalid id', async () => {
          await testData.transactionCommonTests.testReadTransactionWithInvalidId();
        });

        it('Cannot read a transaction without providing id', async () => {
          await testData.transactionCommonTests.testReadTransactionWithoutId();
        });

        it('Cannot read a transaction of another user', async () => {
          const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          await testData.transactionCommonTests.testReadTransactionOfUser(false, anotherUser.tags[0].id);
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

        it(
          'Can read a closed transaction without meter values and no meterStart',
          async () => {
            await testData.transactionCommonTests.testReadClosedTransactionWithoutMeterStartAndMeterValues();
          }
        );

        it(
          'Can read a closed transaction without meter values and a meterStart different from meterStop',
          async () => {
            await testData.transactionCommonTests.testReadClosedTransactionWithDifferentMeterStartAndMeterStop();
          }
        );

      });

      describe('Using function "readAllConsumption"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it(
          'Can read consumption of a started transaction without meter values',
          async () => {
            await testData.transactionCommonTests.testReadConsumptionStartedTransactionWithoutMeterValues();
          }
        );

        it(
          'Can read consumption of a started transaction with multiple meter values',
          async () => {
            await testData.transactionCommonTests.testReadConsumptionStartedTransactionWithMultipleMeterValues();
          }
        );

        it(
          'Can read consumption of a stopped transaction without meter values',
          async () => {
            await testData.transactionCommonTests.testReadConsumptionStoppedTransactionWithoutMeterValues();
          }
        );

      });

      describe('Using function "getTransactionsActive"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        afterEach(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Can read on a charger without active transactions', async () => {
          await testData.transactionCommonTests.testReadActiveTransactionsWithoutActiveTransactions();
        });

        it('Can read on a charger with multiple active transactions', async () => {
          await testData.transactionCommonTests.testReadActiveTransactionsWithMultipleActiveTransactions();
        });

      });

      describe('Using function "delete"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Cannot delete a not existing transaction', async () => {
          await testData.transactionCommonTests.testDeleteNotExistingTransaction();
        });

        it('Cannot delete a transaction with invalid id', async () => {
          await testData.transactionCommonTests.testDeleteTransactionWithInvalidId();
        });

        it('Cannot delete a transaction without providing id', async () => {
          await testData.transactionCommonTests.testDeleteTransactionWithoutId();
        });

        it('Cannot delete a started transaction', async () => {
          await testData.transactionCommonTests.testDeleteStartedTransaction(false);
        });

        it('Cannot delete a closed transaction', async () => {
          await testData.transactionCommonTests.testDeleteClosedTransaction(false);
        });

      });

      describe('Using function "exportTransactions"', () => {
        it('Should export completed transactions', async () => {
          await testData.transactionCommonTests.testExportTransactions({});
        });
      });
    });

    describe('Where admin user', () => {

      beforeAll(() => {
        testData.transactionCommonTests.setUser(
          testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN)
        );
      });

      describe('Using function "readById"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Should be authorized on a started transaction by itself', async () => {
          await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, true, true);
        });

        it('Should be authorized on a transaction started by another', async () => {
          const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          await testData.transactionCommonTests.testIsAuthorizedOnStartedTransaction(true, true, true, anotherUser.tags[0].id);
        });

        it(
          'Should be authorized to stop a transaction started by itself',
          async () => {
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, true);
          }
        );

        it(
          'Should be authorized to stop a transaction started by another',
          async () => {
            const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
            await testData.transactionCommonTests.testIsAuthorizedToStopTransaction(true, true, anotherUser.tags[0].id);
          }
        );

        it('Can read a transaction of another user', async () => {
          const anotherUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          await testData.transactionCommonTests.testReadTransactionOfUser(true, anotherUser.tags[0].id);
        });
      });

      describe('Using function "delete"', () => {

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it('Can delete a started transaction', async () => {
          await testData.transactionCommonTests.testDeleteStartedTransaction();
        });

        it('Can delete a closed transaction', async () => {
          await testData.transactionCommonTests.testDeleteClosedTransaction();
        });

      });

    });

  });

});
