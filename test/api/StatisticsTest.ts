import chai, { expect } from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import responseHelper from '../helpers/responseHelper';
import CentralServerService from '../api/client/CentralServerService';
import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';
import StatisticsContext from './contextProvider/StatisticsContext';
import StatisticsApi from './client/StatisticsApi';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

// For Visual Studio it is recommended to install Mocha sidebar and Chai snippets
// Mocha is the test framework and chai provides functions to check expectations

describe('Statistics tests', function() {
  this.timeout(20000); // Will automatically stop the unit test after that period of time

  let tenantContextNothing: any;
  let adminUserServerServiceNothing: CentralServerService;

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
  let expectedInactivity = 0;

  let statisticsContext: StatisticsContext;

  before(async () => {
    chai.config.includeStack = true;

    // Prepare data before the whole test chain is started
    await ContextProvider.DefaultInstance.prepareContexts();

    tenantContextNothing = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS);
    let adminUser = tenantContextNothing.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
    adminUserServerServiceNothing = new CentralServerService(tenantContextNothing.getTenant().subdomain, adminUser);

    tenantContextAll = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
    const basicUser = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
    basicUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, basicUser);
    adminUser = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
    adminUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, adminUser);
    const demoUser = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.DEMO_USER);
    demoUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, demoUser);

    const allYears = await adminUserServerService.statisticsApi.readAllYears();
    if (allYears && allYears.data && Array.isArray(allYears.data) && allYears.data.length > 0) {
      numberOfYears = allYears.data.length;
      firstYear = allYears.data[0];
    }

    // Chargers of only one site area are used for generating transaction data:
    const siteContextAll = tenantContextAll.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
    const siteAreaContextAll = siteContextAll.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
    const chargingStationsAll = siteAreaContextAll.getChargingStations();
    numberOfChargers = chargingStationsAll.length;

    numberOfUsers = StatisticsContext.USERS.length;
    expectedConsumption = StatisticsContext.CONSTANTS.ENERGY_PER_MINUTE * StatisticsContext.CONSTANTS.CHARGING_MINUTES / 1000;
    expectedUsage = (StatisticsContext.CONSTANTS.CHARGING_MINUTES + StatisticsContext.CONSTANTS.IDLE_MINUTES) / 60;
    expectedInactivity = StatisticsContext.CONSTANTS.IDLE_MINUTES / 60;
  });

  afterEach(() => {
    // Should be called after each UT to clean up created data
  });

  after(async () => {
    // Can be called at the end to ensure proper data clean up
    await ContextProvider.DefaultInstance.cleanUpCreatedContent();
  });

  describe('Without activated component (tenant ut-nothing)', () => {

    describe('Where even admin user', () => {

      it('Is not authorized to access consumption data', async () => {
        let adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readChargingStationConsumption({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(560);
        expect(adminUserListResponse.data.message,
          `Message from query for year ${firstYear} on data per charging station should contain "inactive"`
        ).to.contain('inactive');

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readUserConsumption({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(560);
        expect(adminUserListResponse.data.message,
          `Message from query for year ${firstYear} on data per user should contain "inactive"`
        ).to.contain('inactive');
      });

      it('Is not authorized to access usage data', async () => {
        let adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readChargingStationUsage({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(560);
        expect(adminUserListResponse.data.message,
          `Message from query for year ${firstYear} on data per charging station should contain "inactive"`
        ).to.contain('inactive');

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readUserUsage({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(560);
        expect(adminUserListResponse.data.message,
          `Message from query for year ${firstYear} on data per user should contain "inactive"`
        ).to.contain('inactive');
      });

      it('Is not authorized to access inactivity data', async () => {
        let adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readChargingStationInactivity({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(560);
        expect(adminUserListResponse.data.message,
          `Message from query for year ${firstYear} on data per charging station should contain "inactive"`
        ).to.contain('inactive');

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readUserInactivity({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(560);
        expect(adminUserListResponse.data.message,
          `Message from query for year ${firstYear} on data per user should contain "inactive"`
        ).to.contain('inactive');
      });

    });
  });

  describe('With activated component (tenant ut-all)', () => {

    describe('Where admin user', () => {

      it('Should see annual consumption data for all users', async () => {
        let adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationConsumption({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(200);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfUsers * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * numberOfUsers * expectedConsumption);
        }
        adminUserListResponse = await adminUserServerService.statisticsApi.readUserConsumption({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(200);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfUsers * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * numberOfUsers * expectedConsumption);
        }
      });

      it('Should see annual usage data for another user', async () => {
        const user = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
        let adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationUsage({ Year: firstYear, UserID: user.id });
        expect(adminUserListResponse.status).to.be.eql(200);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} and user ${user.name} (basic user) on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Usage data should be ${numberOfChargers * expectedUsage} hours`
          ).to.be.eql(numberOfChargers * expectedUsage);
        }
        adminUserListResponse = await adminUserServerService.statisticsApi.readUserUsage({ Year: firstYear, UserID: user.id });
        expect(adminUserListResponse.status).to.be.eql(200);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} and user ${user.name} (basic user) on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Usage data should be ${numberOfChargers * expectedUsage} hours`
          ).to.be.eql(numberOfChargers * expectedUsage);
        }
      });

      it('Should see overall inactivity data', async () => {
        let adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationInactivity({});
        expect(adminUserListResponse.status).to.be.eql(200);
        expect(adminUserListResponse.data,
          'Query response for all years on data per charging station should not be empty'
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Inactivity data should be ${numberOfChargers * numberOfUsers * numberOfYears * expectedInactivity} hours`
          ).to.be.eql(numberOfChargers * numberOfUsers * numberOfYears * expectedInactivity);
        }
        adminUserListResponse = await adminUserServerService.statisticsApi.readUserInactivity({});
        expect(adminUserListResponse.status).to.be.eql(200);
        expect(adminUserListResponse.data,
          'Query response for all years on data per user should not be empty'
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Inactivity data should be ${numberOfChargers * numberOfUsers * numberOfYears * expectedInactivity} hours`
          ).to.be.eql(numberOfChargers * numberOfUsers * numberOfYears * expectedInactivity);
        }
      });

    });

    describe('Where basic user', () => {

      it('Should see annual consumption data only for own user', async () => {
        let basicUserListResponse = await basicUserServerService.statisticsApi.readChargingStationConsumption({ Year: firstYear });
        expect(basicUserListResponse.status).to.be.eql(200);
        expect(basicUserListResponse.data,
          `Query response for year ${firstYear} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * expectedConsumption);
        }
        basicUserListResponse = await basicUserServerService.statisticsApi.readUserConsumption({ Year: firstYear });
        expect(basicUserListResponse.status).to.be.eql(200);
        expect(basicUserListResponse.data,
          `Query response for year ${firstYear} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * expectedConsumption);
        }
      });

      it('Should see overall usage data only for own user', async () => {
        let basicUserListResponse = await basicUserServerService.statisticsApi.readChargingStationUsage({});
        expect(basicUserListResponse.status).to.be.eql(200);
        expect(basicUserListResponse.data,
          'Query response for all years on data per charging station should not be empty'
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Usage data should be ${numberOfChargers * numberOfYears * expectedUsage} hours`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedUsage);
        }
        basicUserListResponse = await basicUserServerService.statisticsApi.readUserUsage({});
        expect(basicUserListResponse.status).to.be.eql(200);
        expect(basicUserListResponse.data,
          'Query response for all years on data per user should not be empty'
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Usage data should be ${numberOfChargers * numberOfYears * expectedUsage} hours`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedUsage);
        }
      });

      it('Should see annual inactivity data of a specific charger only for own user', async () => {
        const siteContext = tenantContextAll.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
        const siteAreaContext = siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
        const chargingStationContext = siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        let basicUserListResponse = await basicUserServerService.statisticsApi.readChargingStationInactivity({ Year: firstYear, ChargeBoxID: chargingStationContext.getChargingStation().id });
        expect(basicUserListResponse.status).to.be.eql(200);
        expect(basicUserListResponse.data,
          `Query response for year ${firstYear} and charger ${chargingStationContext.getChargingStation().id} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Inactivity data should be ${expectedInactivity} hours`
          ).to.be.eql(expectedInactivity);
        }
        basicUserListResponse = await basicUserServerService.statisticsApi.readUserInactivity({ Year: firstYear, ChargeBoxID: chargingStationContext.getChargingStation().id });
        expect(basicUserListResponse.status).to.be.eql(200);
        expect(basicUserListResponse.data,
          `Query response for year ${firstYear} and charger ${chargingStationContext.getChargingStation().id} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Inactivity data should be ${expectedInactivity} hours`
          ).to.be.eql(expectedInactivity);
        }
      });

    });

    describe('Where demo user', () => {

      it('Should see annual consumption data for all users', async () => {
        let demoUserListResponse = await demoUserServerService.statisticsApi.readChargingStationConsumption({ Year: firstYear });
        expect(demoUserListResponse.status).to.be.eql(200);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfUsers * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * numberOfUsers * expectedConsumption);
        }
        demoUserListResponse = await demoUserServerService.statisticsApi.readUserConsumption({ Year: firstYear });
        expect(demoUserListResponse.status).to.be.eql(200);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfUsers * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * numberOfUsers * expectedConsumption);
        }
      });

      it('Should see annual usage data for a specific charger', async () => {
        const siteContext = tenantContextAll.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
        const siteAreaContext = siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
        const chargingStationContext = siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        let demoUserListResponse = await demoUserServerService.statisticsApi.readChargingStationUsage({ Year: firstYear, ChargeBoxID: chargingStationContext.getChargingStation().id });
        expect(demoUserListResponse.status).to.be.eql(200);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} and charger ${chargingStationContext.getChargingStation().id} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Usage data should be ${numberOfUsers * expectedUsage} hours`
          ).to.be.eql(numberOfUsers * expectedUsage);
        }
        demoUserListResponse = await demoUserServerService.statisticsApi.readUserUsage({ Year: firstYear, ChargeBoxID: chargingStationContext.getChargingStation().id });
        expect(demoUserListResponse.status).to.be.eql(200);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} and charger ${chargingStationContext.getChargingStation().id} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Usage data should be ${numberOfUsers * expectedUsage} hours`
          ).to.be.eql(numberOfUsers * expectedUsage);
        }
      });

      it('Should see overall inactivity data for another user', async () => {
        const user = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
        let demoUserListResponse = await demoUserServerService.statisticsApi.readChargingStationInactivity({ Year: firstYear, UserID: user.id });
        expect(demoUserListResponse.status).to.be.eql(200);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} and user ${user.name} (basic user) on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Inactivity data should be ${numberOfYears * expectedInactivity} hours`
          ).to.be.eql(numberOfYears * expectedInactivity);
        }
        demoUserListResponse = await demoUserServerService.statisticsApi.readUserInactivity({ Year: firstYear, UserID: user.id });
        expect(demoUserListResponse.status).to.be.eql(200);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} and user ${user.name} (basic user) on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Inactivity data should be ${numberOfYears * expectedInactivity} hours`
          ).to.be.eql(numberOfUsers * expectedInactivity);
        }
      });

    });

  });
});

function timeout(ms) {
  return new Promise((resolve) => {
    return setTimeout(resolve, ms);
  });
}
