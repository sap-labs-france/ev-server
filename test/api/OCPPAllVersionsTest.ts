import ChargingStationContext from './context/ChargingStationContext';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import OCPPCommonTests from './OCPPCommonTests';
import SiteAreaContext from './context/SiteAreaContext';
import SiteContext from './context/SiteContext';
import TenantContext from './context/TenantContext';
import chai from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public ocppCommonTests: OCPPCommonTests;
  public siteContext: SiteContext;
  public siteAreaContext: SiteAreaContext;
  public chargingStationContext: ChargingStationContext;
}

const testData: TestData = new TestData();

describe('OCPP Service (all versions)', () => {
  jest.setTimeout(300000); // Will automatically stop the unit test after that period of time

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

  describe('Without any component (utnothing)', () => {

    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.ocppCommonTests = new OCPPCommonTests(testData.tenantContext, testData.centralUserContext, true);

      await testData.ocppCommonTests.before();
    });

    afterAll(async () => {
      await testData.ocppCommonTests.after();
    });

    describe('For OCPP Version 1.5 (SOAP)', () => {

      beforeAll(() => {
        testData.chargingStationContext = testData.tenantContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15);
        testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
      });

      afterAll(async () => {
        await testData.chargingStationContext.cleanUpCreatedData();
      });

      describe('Where any user', () => {

        it(
          'With tag as integer should be authorized to start a transaction',
          async () => {
            await testData.ocppCommonTests.testAuthorizeTagAsInteger();
          }
        );

        it(
          'With invalid tag should not be authorized to start a transaction',
          async () => {
            await testData.ocppCommonTests.testAuthorizeInvalidTag();
          }
        );

        it(
          'Should be able to start a transaction with connectorId as string',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithConnectorIdAsString();
          }
        );

        it(
          'Should be able to start a transaction with meterStart greater than 0',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithMeterStartGreaterZero();
          }
        );

        it(
          'Should not be able to start a transaction with invalid tag',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithInvalidTag();
          }
        );

        it(
          'Should be able to stop a transaction without transactionData',
          async () => {
            await testData.ocppCommonTests.testStopTransactionWithoutTransactionData();
          }
        );

        it('Should be able to stop a transaction with transactionData', async () => {
          await testData.ocppCommonTests.testStopTransactionWithTransactionData();
        });

        it(
          'Should not be able to stop a transaction with invalid transactionData',
          async () => {
            await testData.ocppCommonTests.testStopTransactionWithInvalidTransactionData();
          }
        );

        it('Should be able to retrieve the last reboot date', async () => {
          await testData.ocppCommonTests.testRetrieveLastRebootDate();
        });

        it(
          'Should be able to perform a transaction, where Keba clock meterValues are ignored',
          async () => {
            await testData.ocppCommonTests.testTransactionIgnoringClockMeterValues();
          }
        );

        it(
          'Charging station should set both of its connectors to Available',
          async () => {
            await testData.ocppCommonTests.testConnectorStatus();
          }
        );

        it('Charging station should send its heartbeat', async () => {
          await testData.ocppCommonTests.testHeartbeat();
        });

        it(
          'Charging station should have saved the connection\'s IP address',
          async () => {
            await testData.ocppCommonTests.testClientIP();
          }
        );

        it(
          'Charging station can change its connector status to Occupied',
          async () => {
            await testData.ocppCommonTests.testChangeConnectorStatus();
          }
        );

        it('Charging station should send data transfer', async () => {
          await testData.ocppCommonTests.testDataTransfer();
        });

        it(
          'Should not be able to remote start transaction without a badge',
          async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithNoBadge();
          }
        );

      });

      describe('Where basic user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED)
          );
        });

        it('Should authorize transaction', async () => {
          await testData.ocppCommonTests.testStartTransaction();
        });

      });

      describe('Where admin user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED)
          );
        });

        it('Should authorize transaction', async () => {
          await testData.ocppCommonTests.testStartTransaction();
        });

      });

      describe('Where external user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.EXTERNAL_USER)
          );
        });

        it('Should not be authorized on a remote start transaction', async () => {
          await testData.ocppCommonTests.testRemoteStartTransactionWithExternalUser();
        });

      });

    });

    describe('For OCPP Version 1.6 (JSON)', () => {

      beforeAll(() => {
        testData.chargingStationContext = testData.tenantContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
        testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
      });

      afterAll(async () => {
        await testData.chargingStationContext.cleanUpCreatedData();
      });

      describe('Where any user', () => {

        it(
          'With tag as integer should be authorized to start a transaction',
          async () => {
            await testData.ocppCommonTests.testAuthorizeTagAsInteger();
          }
        );

        it(
          'With invalid tag should not be authorized to start a transaction',
          async () => {
            await testData.ocppCommonTests.testAuthorizeInvalidTag();
          }
        );

        it(
          'Should be able to start a transaction with connectorId as string',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithConnectorIdAsString();
          }
        );

        it(
          'Should be able to start a transaction with meterStart greater than 0',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithMeterStartGreaterZero();
          }
        );

        it(
          'Should not be able to start a transaction with invalid tag',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithInvalidTag();
          }
        );

        it(
          'Should be able to stop a transaction without transactionData',
          async () => {
            await testData.ocppCommonTests.testStopTransactionWithoutTransactionData();
          }
        );

        it('Should be able to stop a transaction with transactionData', async () => {
          await testData.ocppCommonTests.testStopTransactionWithTransactionData();
        });

        it(
          'Should not be able to stop a transaction with invalid transactionData',
          async () => {
            await testData.ocppCommonTests.testStopTransactionWithInvalidTransactionData();
          }
        );

        it('Should be able to retrieve the last reboot date', async () => {
          await testData.ocppCommonTests.testRetrieveLastRebootDate();
        });

        it(
          'Should be able to perform a transaction, where Keba clock meterValues are ignored',
          async () => {
            await testData.ocppCommonTests.testTransactionIgnoringClockMeterValues();
          }
        );

        it(
          'Charging station should set both of its connectors to Available',
          async () => {
            await testData.ocppCommonTests.testConnectorStatus();
          }
        );

        it('Charging station should send its heartbeat', async () => {
          await testData.ocppCommonTests.testHeartbeat();
        });

        it(
          'Charging station should have saved the connection\'s IP address',
          async () => {
            await testData.ocppCommonTests.testClientIP();
          }
        );

        it(
          'Charging station can change its connector status to Occupied',
          async () => {
            await testData.ocppCommonTests.testChangeConnectorStatus();
          }
        );

        it('Charging station should send data transfer', async () => {
          await testData.ocppCommonTests.testDataTransfer();
        });

        it(
          'Should not be able to remote start transaction without a badge',
          async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithNoBadge();
          }
        );

      });

      describe('Where basic user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED)
          );
        });

        it('Should authorize transaction', async () => {
          await testData.ocppCommonTests.testStartTransaction();
        });

      });

      describe('Where admin user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED)
          );
        });

        it('Should authorize transaction', async () => {
          await testData.ocppCommonTests.testStartTransaction();
        });

      });

      describe('Where external user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.EXTERNAL_USER)
          );
        });

        it('Should not be authorized on a remote start transaction', async () => {
          await testData.ocppCommonTests.testRemoteStartTransactionWithExternalUser();
        });

      });

    });

  });

  describe('With component Organization only (utorg)', () => {

    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.ocppCommonTests = new OCPPCommonTests(testData.tenantContext, testData.centralUserContext);

      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);

      await testData.ocppCommonTests.before();
    });

    afterAll(async () => {
      await testData.ocppCommonTests.after();
    });

    describe('For OCPP Version 1.5 (SOAP)', () => {
      describe('With unregistered charger', () => {
        beforeAll(() => {
          testData.chargingStationContext = testData.tenantContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.UNREGISTERED_OCPP15);
          testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
        });

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it(
          'Should not be possible to register a charging station with invalid token',
          async () => {
            await testData.ocppCommonTests.testChargingStationRegistrationWithInvalidToken();
          }
        );
      });

      describe('With invalid charging station identifier', () => {
        beforeAll(() => {
          testData.chargingStationContext = testData.tenantContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.INVALID_IDENTIFIER_OCPP15);
          testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
        });

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it(
          'Should not be possible to register a charging station with invalid identifier',
          async () => {
            await testData.ocppCommonTests.testChargingStationRegistrationWithInvalidIdentifier();
          }
        );
      });

      describe('With charger assigned to a site area', () => {

        beforeAll(() => {
          testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
          testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
        });

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        describe('Where basic user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER)
            );
          });

          it('Should authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

        });

        describe('Where unassigned basic user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

        });

        describe('Where admin user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN)
            );
          });

          it('Should authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

        });

        describe('Where unassigned admin user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED)
            );
          });

          it('Should authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

        });

        describe('Where external user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.EXTERNAL_USER)
            );
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithExternalUser();
          });

        });

      });

      describe('With charger not assigned to a site area', () => {

        beforeAll(() => {
          testData.chargingStationContext = testData.tenantContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15);
          testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
        });

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        describe('Where basic user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithUnassignedChargingStation();
          });

        });

        describe('Where unassigned basic user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithUnassignedChargingStation();
          });

        });

        describe('Where admin user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithUnassignedChargingStation();
          });

        });

        describe('Where unassigned admin user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithUnassignedChargingStation();
          });

        });

        describe('Where external user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.EXTERNAL_USER)
            );
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithUnassignedChargingStation();
          });

        });

      });

    });

    describe('For OCPP Version 1.6 (JSON)', () => {
      describe('With unregistered charger', () => {
        beforeAll(() => {
          testData.chargingStationContext = testData.tenantContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.UNREGISTERED_OCPP16);
          testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
        });

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it(
          'Should not be possible to register a charging station with invalid token',
          async () => {
            await testData.ocppCommonTests.testChargingStationRegistrationWithInvalidToken();
          }
        );
      });

      describe('With invalid charging station identifier', () => {
        beforeAll(() => {
          testData.chargingStationContext = testData.tenantContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.INVALID_IDENTIFIER_OCPP16);
          testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
        });

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        it(
          'Should not be possible to register a charging station with invalid identifier',
          async () => {
            await testData.ocppCommonTests.testChargingStationRegistrationWithInvalidIdentifier();
          }
        );
      });

      describe('With charger assigned to a site area', () => {

        beforeAll(() => {
          testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
          testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
        });

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        describe('Where basic user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER)
            );
          });

          it('Should authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

        });

        describe('Where unassigned basic user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

        });

        describe('Where admin user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN)
            );
          });

          it('Should authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

        });

        describe('Where unassigned admin user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED)
            );
          });

          it('Should authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

        });

        describe('Where external user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.EXTERNAL_USER)
            );
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithExternalUser();
          });

        });

      });

      describe('With charger not assigned to a site area', () => {

        beforeAll(() => {
          testData.chargingStationContext = testData.tenantContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
          testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
        });

        afterAll(async () => {
          await testData.chargingStationContext.cleanUpCreatedData();
        });

        describe('Where basic user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

        });

        describe('Where unassigned basic user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER_UNASSIGNED)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithUnassignedChargingStation();
          });

        });

        describe('Where admin user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithUnassignedChargingStation();
          });

        });

        describe('Where unassigned admin user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.ADMIN_UNASSIGNED)
            );
          });

          it('Should not authorize transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction(false);
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithUnassignedChargingStation();
          });

        });

        describe('Where external user', () => {

          beforeAll(() => {
            testData.ocppCommonTests.setUsers(
              testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.EXTERNAL_USER)
            );
          });

          it('Should not be authorized on a remote start transaction', async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithUnassignedChargingStation();
          });

        });

      });

    });

  });

  describe('With components Organization and Pricing (utall)', () => {

    beforeAll(async () => {
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.ocppCommonTests = new OCPPCommonTests(testData.tenantContext, testData.centralUserContext, true);

      testData.siteContext = testData.tenantContext.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);

      await testData.ocppCommonTests.before();
      await testData.ocppCommonTests.assignAnyUserToSite(testData.siteContext);
    });

    afterAll(async () => {
      await testData.ocppCommonTests.after();
    });

    describe('For OCPP Version 1.5 (SOAP)', () => {

      beforeAll(() => {
        testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
      });

      afterAll(async () => {
        await testData.chargingStationContext.cleanUpCreatedData();
      });
      describe('Where any user', () => {

        it(
          'With tag as integer should be authorized to start a transaction',
          async () => {
            await testData.ocppCommonTests.testAuthorizeTagAsInteger();
          }
        );

        it(
          'With invalid tag should not be authorized to start a transaction',
          async () => {
            await testData.ocppCommonTests.testAuthorizeInvalidTag();
          }
        );

        it(
          'Should be able to start a transaction with connectorId as string',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithConnectorIdAsString();
          }
        );

        it(
          'Should be able to start a transaction with meterStart greater than 0',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithMeterStartGreaterZero();
          }
        );

        it(
          'Should not be able to start a transaction with invalid tag',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithInvalidTag();
          }
        );

        it(
          'Should be able to stop a transaction without transactionData',
          async () => {
            await testData.ocppCommonTests.testStopTransactionWithoutTransactionData();
          }
        );

        it('Should be able to stop a transaction with transactionData', async () => {
          await testData.ocppCommonTests.testStopTransactionWithTransactionData();
        });

        it(
          'Should not be able to stop a transaction with invalid transactionData',
          async () => {
            await testData.ocppCommonTests.testStopTransactionWithInvalidTransactionData();
          }
        );

        it('Should be able to retrieve the last reboot date', async () => {
          await testData.ocppCommonTests.testRetrieveLastRebootDate();
        });

        it(
          'Should be able to perform a transaction, where Keba clock meterValues are ignored',
          async () => {
            await testData.ocppCommonTests.testTransactionIgnoringClockMeterValues();
          }
        );

        it(
          'Charging station should set both of its connectors to Available',
          async () => {
            await testData.ocppCommonTests.testConnectorStatus();
          }
        );

        it('Charging station should send its heartbeat', async () => {
          await testData.ocppCommonTests.testHeartbeat();
        });

        it(
          'Charging station should have saved the connection\'s IP address',
          async () => {
            await testData.ocppCommonTests.testClientIP();
          }
        );

        it(
          'Charging station can change its connector status to Occupied',
          async () => {
            await testData.ocppCommonTests.testChangeConnectorStatus();
          }
        );

        it('Charging station should send data transfer', async () => {
          await testData.ocppCommonTests.testDataTransfer();
        });

        it(
          'Should not be able to remote start transaction without a badge',
          async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithNoBadge();
          }
        );

      });

      describe('Where basic user as start and stop user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER)
          );
        });

        describe('Users should be able to perform a complete regular transaction cycle', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it('Start user should be able to start a new transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

          it(
            'User should be able to start a second time a new transaction',
            async () => {
              await testData.ocppCommonTests.testStartSecondTransaction();
            }
          );

          it('Charging station should send meter values', async () => {
            await testData.ocppCommonTests.testSendMeterValues();
          });

          it('Stop user should be able to stop the transaction', async () => {
            await testData.ocppCommonTests.testStopTransaction();
          });

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics();
            }
          );

          it('Start user should not be able to delete his transaction', async () => {
            await testData.ocppCommonTests.testDeleteTransaction(true);
          });

        });

      });

      describe('Where basic user as start user and admin user as stop user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER),
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN)
          );
        });

        describe('Users should be able to perform a complete regular transaction cycle', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it('Start user should be able to start a new transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

          it(
            'Start user should be able to start a second time a new transaction',
            async () => {
              await testData.ocppCommonTests.testStartSecondTransaction();
            }
          );

          it('Charging station should send meter values', async () => {
            await testData.ocppCommonTests.testSendMeterValues();
          });

          it('Stop user should be able to stop the transaction', async () => {
            await testData.ocppCommonTests.testStopTransaction();
          });

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics();
            }
          );

          it('Start user should not be able to delete his transaction', async () => {
            await testData.ocppCommonTests.testDeleteTransaction(true);
          });

        });

      });

    });

    describe('For OCPP Version 1.6 (JSON)', () => {

      beforeAll(() => {
        testData.chargingStationContext = testData.siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
        testData.ocppCommonTests.setChargingStation(testData.chargingStationContext);
      });

      afterAll(async () => {
        await testData.chargingStationContext.cleanUpCreatedData();
      });

      describe('Where any user', () => {

        it(
          'With tag as integer should be authorized to start a transaction',
          async () => {
            await testData.ocppCommonTests.testAuthorizeTagAsInteger();
          }
        );

        it(
          'With invalid tag should not be authorized to start a transaction',
          async () => {
            await testData.ocppCommonTests.testAuthorizeInvalidTag();
          }
        );

        it(
          'Should be able to start a transaction with connectorId as string',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithConnectorIdAsString();
          }
        );

        it(
          'Should be able to start a transaction with meterStart greater than 0',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithMeterStartGreaterZero();
          }
        );

        it(
          'Should not be able to start a transaction with invalid tag',
          async () => {
            await testData.ocppCommonTests.testStartTransactionWithInvalidTag();
          }
        );

        it(
          'Should be able to stop a transaction without transactionData',
          async () => {
            await testData.ocppCommonTests.testStopTransactionWithoutTransactionData();
          }
        );

        it('Should be able to stop a transaction with transactionData', async () => {
          await testData.ocppCommonTests.testStopTransactionWithTransactionData();
        });

        it(
          'Should not be able to stop a transaction with invalid transactionData',
          async () => {
            await testData.ocppCommonTests.testStopTransactionWithInvalidTransactionData();
          }
        );

        it('Should be able to retrieve the last reboot date', async () => {
          await testData.ocppCommonTests.testRetrieveLastRebootDate();
        });

        it(
          'Should be able to perform a transaction, where Keba clock meterValues are ignored',
          async () => {
            await testData.ocppCommonTests.testTransactionIgnoringClockMeterValues();
          }
        );

        it(
          'Charging station should set both of its connectors to Available',
          async () => {
            await testData.ocppCommonTests.testConnectorStatus();
          }
        );

        it('Charging station should send its heartbeat', async () => {
          await testData.ocppCommonTests.testHeartbeat();
        });

        it(
          'Charging station should have saved the connection\'s IP address',
          async () => {
            await testData.ocppCommonTests.testClientIP();
          }
        );

        it(
          'Charging station can change its connector status to Occupied',
          async () => {
            await testData.ocppCommonTests.testChangeConnectorStatus();
          }
        );

        it('Charging station should send data transfer', async () => {
          await testData.ocppCommonTests.testDataTransfer();
        });

        it(
          'Should not be able to remote start transaction without a badge',
          async () => {
            await testData.ocppCommonTests.testRemoteStartTransactionWithNoBadge();
          }
        );

      });

      describe('Where basic user as start and stop user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER)
          );
        });

        describe('Users should be able to perform a complete regular transaction cycle', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it('Start user should be able to start a new transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

          it(
            'Start user should be able to start a second time a new transaction',
            async () => {
              await testData.ocppCommonTests.testStartSecondTransaction();
            }
          );

          it('Charging station should send meter values', async () => {
            await testData.ocppCommonTests.testSendMeterValues();
          });

          it('Stop user should be able to stop the transaction', async () => {
            await testData.ocppCommonTests.testStopTransaction();
          });

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics(false, true);
            }
          );

          it('Start user should not be able to delete his transaction', async () => {
            await testData.ocppCommonTests.testDeleteTransaction(true);
          });

        });

        describe('Users should be able to perform a complete transaction cycle with SoC', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it(
            'Start user should be able to start a new transaction (with SoC)',
            async () => {
              await testData.ocppCommonTests.testStartTransaction(true);
            }
          );

          it('Charging station should send meter values (with SoC)', async () => {
            await testData.ocppCommonTests.testSendMeterValues(true);
          });

          it(
            'Stop user should be able to stop the transaction (with SoC)',
            async () => {
              await testData.ocppCommonTests.testStopTransaction(true);
            }
          );

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity (with SoC)',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics(true, true);
            }
          );

          it(
            'Start user should not be able to delete his transaction (with SoC)',
            async () => {
              await testData.ocppCommonTests.testDeleteTransaction(true);
            }
          );

        });

        describe('Users should be able to perform a complete transaction cycle with SignedData(Continual Updates)', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it(
            'Start user should be able to start a new transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testStartTransaction();
            }
          );

          it(
            'Charging station should send meter values (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testSendMeterValues(false, true);
            }
          );

          it(
            'Stop user should be able to stop the transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testStopTransaction(false, true);
            }
          );

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics(false, true);
            }
          );

          it(
            'Start user should not be able to delete his transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testDeleteTransaction(true);
            }
          );

        });

        describe('Users should be able to perform a complete transaction cycle with SignedData(Only in StopTransaction)', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it(
            'Start user should be able to start a new transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testStartTransaction();
            }
          );

          it(
            'Charging station should send meter values (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testSendMeterValues(false, true, true);
            }
          );

          it(
            'Stop user should be able to stop the transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testStopTransaction(false, true);
            }
          );

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics(false, true);
            }
          );

          it(
            'Start user should not be able to delete his transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testDeleteTransaction(true);
            }
          );

        });

      });

      describe('Where basic user as start user and admin user as stop user', () => {

        beforeAll(() => {
          testData.ocppCommonTests.setUsers(
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER),
            testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN)
          );
        });

        describe('Users should be able to perform a complete regular transaction cycle', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it('Start user should be able to start a new transaction', async () => {
            await testData.ocppCommonTests.testStartTransaction();
          });

          it(
            'Start user should be able to start a second time a new transaction',
            async () => {
              await testData.ocppCommonTests.testStartSecondTransaction();
            }
          );

          it('Charging station should send meter values', async () => {
            await testData.ocppCommonTests.testSendMeterValues();
          });

          it('Stop user should be able to stop the transaction', async () => {
            await testData.ocppCommonTests.testStopTransaction();
          });

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics(false, true);
            }
          );

          it('Start user should not be able to delete his transaction', async () => {
            await testData.ocppCommonTests.testDeleteTransaction(true);
          });

        });

        describe('Users should be able to perform a complete transaction cycle with SoC', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it(
            'Start user should be able to start a new transaction (with SoC)',
            async () => {
              await testData.ocppCommonTests.testStartTransaction(true);
            }
          );

          it('Charging station should send meter values (with SoC)', async () => {
            await testData.ocppCommonTests.testSendMeterValues(true);
          });

          it(
            'Stop user should be able to stop the transaction (with SoC)',
            async () => {
              await testData.ocppCommonTests.testStopTransaction(true);
            }
          );

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity (with SoC)',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics(true, true);
            }
          );

          it(
            'Start user should not be able to delete his transaction (with SoC)',
            async () => {
              await testData.ocppCommonTests.testDeleteTransaction(true);
            }
          );

        });

        describe('Users should be able to perform a complete transaction cycle with SignedData(Continual Updates)', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it(
            'Start user should be able to start a new transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testStartTransaction();
            }
          );

          it(
            'Charging station should send meter values (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testSendMeterValues(false, true);
            }
          );

          it(
            'Stop user should be able to stop the transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testStopTransaction(false, true);
            }
          );

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics(false, true);
            }
          );

          it(
            'Start user should not be able to delete his transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testDeleteTransaction(true);
            }
          );

        });

        describe('Users should be able to perform a complete transaction cycle with SignedData(Only in StopTransaction)', () => {

          afterAll(async () => {
            await testData.chargingStationContext.cleanUpCreatedData();
          });

          it(
            'Start user should be able to start a new transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testStartTransaction();
            }
          );

          it(
            'Charging station should send meter values (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testSendMeterValues(false, true, true);
            }
          );

          it(
            'Stop user should be able to stop the transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testStopTransaction(false, true);
            }
          );

          it(
            'Transaction must have the right consumption metrics, pricing and inactivity (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testTransactionMetrics(false, true);
            }
          );

          it(
            'Start user should not be able to delete his transaction (with SignedData)',
            async () => {
              await testData.ocppCommonTests.testDeleteTransaction(true);
            }
          );

        });

      });

    });

  });

});
