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

  describe('With all activated components (tenant ut-all)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      testData.siteContext = testData.tenantContext.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
      expect(testData.tenantContext).to.exist;
      expect(testData.siteAreaContext).to.exist;
    });

    describe('With OCPP 1.5', () => {

      before(() => {
        testData.chargingStationContextAssigned = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15);
        expect(testData.chargingStationContextAssigned).to.exist;
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Where basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction if the charger is assigned to a site area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize transaction if the charger is not assigned to a site area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where unassigned basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should not authorize transaction', async () => {
          const response1 = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response1).to.be.transactionStatus('Invalid');
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction if the charger is assigned to a site area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize transaction if the charger is not assigned to a site area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where unassigned admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should not authorize transaction', async () => {
          const response1 = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response1).to.be.transactionStatus('Invalid');
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionStatus('Invalid');
        });
      });
    });

    describe('With OCPP 1.6', () => {

      before(() => {
        testData.chargingStationContextAssigned = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
        expect(testData.chargingStationContextAssigned).to.exist;
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Where basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction if the charger is assigned to a site area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize transaction if the charger is not assigned to a site area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where unassigned basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should not authorize transaction', async () => {
          const response1 = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response1).to.be.transactionStatus('Invalid');
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction if the charger is assigned to a site area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize transaction if the charger is not assigned to a site area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where unassigned admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should not authorize transaction', async () => {
          const response1 = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response1).to.be.transactionStatus('Invalid');
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionStatus('Invalid');
        });
      });
    });
  });

  describe('With organization component only (tenant ut-org)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_ORGANIZATION);
      testData.siteContext = testData.tenantContext.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
      testData.siteAreaContext = testData.siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
      expect(testData.tenantContext).to.exist;
      expect(testData.siteAreaContext).to.exist;
    });

    describe('With OCPP 1.5', () => {

      before(() => {
        testData.chargingStationContextAssigned = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15);
        expect(testData.chargingStationContextAssigned).to.exist;
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Where basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction if the charger is assigned to a site area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize transaction if the charger is not assigned to a site area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where unassigned basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should not authorize transaction', async () => {
          const response1 = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response1).to.be.transactionStatus('Invalid');
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction if the charger is assigned to a site area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize transaction if the charger is not assigned to a site area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where unassigned admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should not authorize transaction', async () => {
          const response1 = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response1).to.be.transactionStatus('Invalid');
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionStatus('Invalid');
        });
      });
    });

    describe('With OCPP 1.6', () => {

      before(() => {
        testData.chargingStationContextAssigned = testData.siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
        expect(testData.chargingStationContextAssigned).to.exist;
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Where basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction if the charger is assigned to a site area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize transaction if the charger is not assigned to a site area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where unassigned basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should not authorize transaction', async () => {
          const response1 = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response1).to.be.transactionStatus('Invalid');
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction if the charger is assigned to a site area', async () => {
          const response = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionValid;
        });

        it('Should not authorize transaction if the charger is not assigned to a site area', async () => {
          const response = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response).to.be.transactionStatus('Invalid');
        });
      });

      describe('Where unassigned admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should not authorize transaction', async () => {
          const response1 = await testData.chargingStationContextAssigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response1).to.be.transactionStatus('Invalid');
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionStatus('Invalid');
        });
      });
    });
  });

  describe('Without component (tenant ut-nothing)', () => {

    before(async () => {
      testData.tenantContext = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS);
      expect(testData.tenantContext).to.exist;
    });

    describe('With OCPP 1.5', () => {

      before(() => {
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP15);
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Where basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction', async () => {
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionValid;
        });
      });

      describe('Where admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction', async () => {
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionValid;
        });
      });
    });

    describe('With OCPP 1.6', () => {

      before(() => {
        testData.chargingStationContextUnassigned = testData.tenantContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
        expect(testData.chargingStationContextUnassigned).to.exist;
      });

      describe('Where basic user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction', async () => {
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionValid;
        });
      });

      describe('Where admin user', () => {

        before(() => {
          testData.userContext = testData.tenantContext.getUserContext(CONTEXTS.USER_CONTEXTS.ADMIN_UNASSIGNED);
          expect(testData.userContext).to.exist;
        });

        it('Should authorize transaction', async () => {
          const response2 = await testData.chargingStationContextUnassigned.startTransaction(1, testData.userContext.tagIDs[0], 0, moment());
          expect(response2).to.be.transactionValid;
        });
      });
    });
  });
});
