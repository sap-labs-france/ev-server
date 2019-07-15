import chai, { expect } from 'chai';

import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';
import chaiDateTime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';


chai.use(chaiDateTime);
chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
  public tenantContext: any;
  public siteContext: any;
  public siteAreaContext: any;
  public chargingStationContextAssigned: any;
  public chargingStationContextUnassigned: any;
  public userContext: any;
}

const testData: TestData = new TestData();

// For Visual Studio it is recommended to install Mocha sidebar and Chai snippets
// Mocha is the test framework and chai provides functions to check expectations

describe('OCPP Tests', function() {
  this.timeout(10000); // Not mandatory will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    // Used to prepare data before the whole test chain is started
    await ContextProvider.DefaultInstance.prepareContexts();
  });

  afterEach(async () => {
    // Should be called after each UT to clean up created data
    await ContextProvider.DefaultInstance.cleanUpCreatedContent();
  });

  after(async () => {
    // Can be called at the end to ensure proper data clean up
    // ContextProvider.cleanUpCreatedContent();
  });

  describe('Tenant context with all components', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.siteContext = testData.tenantContext.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
      expect(testData.tenantContext).to.exist;
      expect(testData.siteAreaContext).to.exist;
    });

    describe('OCPP 1.5 Tests', () => {

      before(() => {
        testData.chargingStationContextAssigned = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15);
        expect(testData.chargingStationContextAssigned).to.exist;
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Basic User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Admin User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });
    });

    describe('OCPP 1.6 Tests', () => {

      before(() => {
        testData.chargingStationContextAssigned = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
        expect(testData.chargingStationContextAssigned).to.exist;
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Basic User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Admin User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });
    });
  });

  describe('Tenant context with only Organization Component', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_ORGANIZATION);
      testData.siteContext = testData.tenantContext.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
      expect(testData.tenantContext).to.exist;
      expect(testData.siteAreaContext).to.exist;
    });

    describe('OCPP 1.5 Tests', () => {

      before(() => {
        testData.chargingStationContextAssigned = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15);
        expect(testData.chargingStationContextAssigned).to.exist;
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Basic User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Admin User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });
    });

    describe('OCPP 1.6 Tests', () => {

      before(() => {
        testData.chargingStationContextAssigned = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
        expect(testData.chargingStationContextAssigned).to.exist;
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Basic User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Admin User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });
    });
  });

  describe('Tenant context with no Component', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS);
      expect(testData.tenantContext).to.exist;
    });

    describe('OCPP 1.5 Tests', () => {

      before(() => {
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15);
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Basic User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });
      });

      describe('Admin User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });
      });
    });

    describe('OCPP 1.6 Tests', () => {

      before(() => {
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Basic User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });
      });

      describe('Admin User', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize Transaction if the Charger is not assigned to a Site Area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });
      });
    });
  });
});
