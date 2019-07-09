import chai, { expect } from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import responseHelper from '../helpers/responseHelper';
import CentralServerService from '../api/client/CentralServerService';
import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';

import ContextBuilder from './contextProvider/ContextBuilder';
import StatisticsContext from './contextProvider/StatisticsContext';
import StatisticsApi from './client/StatisticsApi';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

// For Visual Studio it is recommended to install Mocha sidebar and Chai snippets
// Mocha is the test framework and chai provides functions to check expectations

describe('Statistics Component', function() {
  this.timeout(300000); // Will automatically stop the unit test after that period of time

  let tenantContextAll: any;
  let basicUserServerService: CentralServerService;
  let adminUserServerService: CentralServerService;
  let demoUserServerService: CentralServerService;

  let numberOfYears = 0;
  let firstYear = 0;
  let numberOfChargers = 0;
  let numberOfUsers = 0;
  let expectedConsumption = 0;
  let expectedUsage = 0;

  let statisticsContext: StatisticsContext;

  before(async () => {
    chai.config.includeStack = true;

    // Build context here:
    //        const contextBuilder = new ContextBuilder();
    //       await contextBuilder.prepareContexts();

    // Prepare data before the whole test chain is started
    await ContextProvider.DefaultInstance.prepareContexts();
    tenantContextAll = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);

    const basicUser = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
    basicUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, basicUser);

    const adminUser = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
    adminUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, adminUser);

    const demoUser = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.DEMO_USER);
    demoUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, demoUser);

    const allYears = await adminUserServerService.statisticsApi.readAllYears();
    if (allYears && allYears.data && Array.isArray(allYears.data) && allYears.data.length > 0) {
      numberOfYears = allYears.data.length;
      firstYear = allYears.data[0];
    }

    numberOfChargers = StatisticsContext.CHARGING_STATIONS.length;
    numberOfUsers = StatisticsContext.USERS.length;
    expectedConsumption = StatisticsContext.CONSTANTS.ENERGY_PER_MINUTE * StatisticsContext.CONSTANTS.CHARGING_MINUTES / 1000;
    expectedUsage = (StatisticsContext.CONSTANTS.CHARGING_MINUTES + StatisticsContext.CONSTANTS.IDLE_MINUTES) / 60;

    if (!numberOfYears) {
      // Create transaction data here (later: in contextBuilder)
      statisticsContext = new StatisticsContext(tenantContextAll);
      numberOfYears = StatisticsContext.CONSTANTS.TRANSACTION_YEARS;
      firstYear = await statisticsContext.createTestData(CONTEXTS.SITE_CONTEXTS.SITE_BASIC, CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
    }
  });

  afterEach(() => {
    // Should be called after each UT to clean up created data
    //    ContextProvider.DefaultInstance.cleanUpCreatedContent();
  });

  after(async () => {
    // Can be called at the end to ensure proper data clean up
    if (statisticsContext) {
      await statisticsContext.deleteTestData();
    }
  });

  describe('Consumption Data', () => {

    it('Basic user should only see charger data for own user', async () => {
      const basicUserListResponse = await basicUserServerService.statisticsApi.readChargingStationConsumption({ Year: firstYear });
      expect(basicUserListResponse.status).to.be.eql(200);
      expect(basicUserListResponse.data, `Consumption data of year ${firstYear} should not be empty`).not.to.be.empty;
      if (Array.isArray(basicUserListResponse.data)) {
        expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]), `Consumption data should be ${numberOfChargers * expectedConsumption} kwH`).to.be.eql(numberOfChargers * expectedConsumption);
      }
    });

    it('Admin user should see charger data for all users', async () => {
      const adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationConsumption({ Year: firstYear });
      expect(adminUserListResponse.status).to.be.eql(200);
      expect(adminUserListResponse.data, `Consumption data of year ${firstYear} should not be empty`).not.to.be.empty;
      if (Array.isArray(adminUserListResponse.data)) {
        expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]), `Consumption data should be ${numberOfChargers * numberOfUsers * expectedConsumption} kwH`).to.be.eql(numberOfChargers * numberOfUsers * expectedConsumption);
      }
    });

    it('Demo user should see user data from all users', async () => {
      const demoUserListResponse = await demoUserServerService.statisticsApi.readUserConsumption({ Year: firstYear });
      expect(demoUserListResponse.status).to.be.eql(200);
      expect(demoUserListResponse.data, `Consumption data of year ${firstYear} should not be empty`).not.to.be.empty;
      if (Array.isArray(demoUserListResponse.data)) {
        expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]), `Consumption data should be ${numberOfChargers * numberOfUsers * expectedConsumption} kwH`).to.be.eql(numberOfChargers * numberOfUsers * expectedConsumption);
      }
    });

  });

  describe('Usage Data', () => {
    it('Basic user should see own user data from all years', async () => {
      const basicUserListResponse = await basicUserServerService.statisticsApi.readUserUsage({});
      expect(basicUserListResponse.status).to.be.eql(200);
      expect(basicUserListResponse.data, 'Usage data from all years should not be empty').not.to.be.empty;
      if (Array.isArray(basicUserListResponse.data)) {
        expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]), `Usage data should be ${numberOfChargers * numberOfYears * expectedUsage} hours`).to.be.eql(numberOfChargers * numberOfYears * expectedUsage);
      }
    });

    it('Admin user should see all data of a specific charger', async () => {
      const siteContext = tenantContextAll.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
      const siteAreaContext = siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
      const chargingStationContext = siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      const adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationUsage({ Year: firstYear, ChargeBoxID: chargingStationContext.getChargingStation().id });
      expect(adminUserListResponse.status).to.be.eql(200);
      expect(adminUserListResponse.data, `Usage data of year ${firstYear} should not be empty`).not.to.be.empty;
      if (Array.isArray(adminUserListResponse.data)) {
        expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]), `Usage data should be ${numberOfUsers * expectedUsage} hours`).to.be.eql(numberOfUsers * expectedUsage);
      }
    });

    it('Demo user should see user data for a specific user ID (not own user)', async () => {
      const user = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
      const demoUserListResponse = await demoUserServerService.statisticsApi.readUserUsage({ Year: firstYear, UserID: user.id });
      expect(demoUserListResponse.status).to.be.eql(200);
      expect(demoUserListResponse.data, `Usage data of year ${firstYear} should not be empty`).not.to.be.empty;
      if (Array.isArray(demoUserListResponse.data)) {
        expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]), `Usage data should be ${numberOfChargers * expectedUsage} hours`).to.be.eql(numberOfChargers * expectedUsage);
      }
    });

  });
});

function timeout(ms) {
  return new Promise((resolve) => {
    return setTimeout(resolve, ms);
  });
}
