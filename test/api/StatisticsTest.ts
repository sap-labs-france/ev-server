import chai, { expect } from 'chai';

import CentralServerService from '../api/client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import StatisticsApi from './client/StatisticsApi';
import StatisticsContext from './context/StatisticsContext';
import { StatusCodes } from 'http-status-codes';
import TestUtils from './TestUtils';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

describe('Statistics', () => {
  jest.setTimeout(30000); // Will automatically stop the unit test after that period of time

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
  let expectedTransactions = 0;
  let expectedPricing = 0;

  beforeAll(async () => {
    chai.config.includeStack = true;

    // Prepare data before the whole test chain is started
    await ContextProvider.defaultInstance.prepareContexts();

    tenantContextNothing = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS);
    let adminUser = tenantContextNothing.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    adminUserServerServiceNothing = new CentralServerService(tenantContextNothing.getTenant().subdomain, adminUser);

    tenantContextAll = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
    const basicUser = tenantContextAll.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
    basicUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, basicUser);
    adminUser = tenantContextAll.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    adminUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, adminUser);
    const demoUser = tenantContextAll.getUserContext(ContextDefinition.USER_CONTEXTS.DEMO_USER);
    demoUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, demoUser);

    const allYears = await adminUserServerService.statisticsApi.readAllYears();
    if (allYears && allYears.data && Array.isArray(allYears.data) && allYears.data.length > 0) {
      numberOfYears = allYears.data.length;
      firstYear = allYears.data[0];
    }

    // Chargers of only one site area were used in the context builder for generating transaction data:
    const siteContextAll = tenantContextAll.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
    const siteAreaContextAll = siteContextAll.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
    const chargingStationsAll = siteAreaContextAll.getChargingStations();
    numberOfChargers = chargingStationsAll.length;

    numberOfUsers = StatisticsContext.USERS.length;
    expectedConsumption = StatisticsContext.CONSTANTS.ENERGY_PER_MINUTE * StatisticsContext.CONSTANTS.CHARGING_MINUTES / 1000;
    expectedUsage = (StatisticsContext.CONSTANTS.CHARGING_MINUTES + StatisticsContext.CONSTANTS.IDLE_MINUTES) / 60;
    expectedInactivity = StatisticsContext.CONSTANTS.IDLE_MINUTES / 60;

    expectedTransactions = 1;
    expectedPricing = ContextDefinition.DEFAULT_PRICE * expectedConsumption;
  });

  afterEach(() => {
    // Can be called after each UT to clean up created data
  });

  afterAll(async () => {
    // Final clean up at the end
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  describe('Without activated component (utnothing)', () => {

    describe('Where even admin user', () => {

      it('Is not authorized to access consumption data', async () => {
        let adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readChargingStationConsumption({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readUserConsumption({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);
      });

      it('Is not authorized to access usage data', async () => {
        let adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readChargingStationUsage({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readUserUsage({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);
      });

      it('Is not authorized to access inactivity data', async () => {
        let adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readChargingStationInactivity({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readUserInactivity({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);
      });

      it('Is not authorized to access sessions data', async () => {
        let adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readChargingStationTransactions({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readUserTransactions({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);
      });

      it('Is not authorized to access pricing data', async () => {
        let adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readChargingStationPricing({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.readUserPricing({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);
      });

      it('Is not authorized to export data to file', async () => {
        let adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.exportStatistics({ Year: firstYear, DataType: 'Consumption', DataCategory: 'C', DataScope: 'month' });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.exportStatistics({ Year: firstYear, DataType: 'Usage', DataCategory: 'U', DataScope: 'month' });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.exportStatistics({ Year: firstYear, DataType: 'Inactivity', DataCategory: 'U', DataScope: 'total' });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.exportStatistics({ Year: firstYear, DataType: 'Transactions', DataCategory: 'C', DataScope: 'total' });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);

        adminUserListResponse = await adminUserServerServiceNothing.statisticsApi.exportStatistics({ Year: firstYear, DataType: 'Pricing', DataCategory: 'U', DataScope: 'month' });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.FORBIDDEN);
      });

    });

  });

  describe('With activated component (utall)', () => {

    describe('Where admin user', () => {

      it('Should see annual consumption data for all users', async () => {
        let adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationConsumption({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfUsers * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * numberOfUsers * expectedConsumption);
        }
        adminUserListResponse = await adminUserServerService.statisticsApi.readUserConsumption({ Year: firstYear });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfUsers * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * numberOfUsers * expectedConsumption);
        }
      });

      it('Should see overall usage data for another user', async () => {
        const user = tenantContextAll.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        let adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationUsage({ UserID: user.id });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for all years and user ${user.name} (basic user) on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Usage data should be ${numberOfChargers * numberOfYears * expectedUsage} hours`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedUsage);
        }
        adminUserListResponse = await adminUserServerService.statisticsApi.readUserUsage({ UserID: user.id });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for all years and user ${user.name} (basic user) on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Usage data should be ${numberOfChargers * numberOfYears * expectedUsage} hours`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedUsage);
        }
      });

      it('Should see annual inactivity data for a specific charger', async () => {
        const siteContext = tenantContextAll.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
        const siteAreaContext = siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
        const chargingStationContext = siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        let adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationInactivity({ Year: firstYear, ChargingStationID: chargingStationContext.getChargingStation().id });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} and charger ${chargingStationContext.getChargingStation().id} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Inactivity data should be ${numberOfUsers * expectedInactivity} hours`
          ).to.be.eql(numberOfUsers * expectedInactivity);
        }
        adminUserListResponse = await adminUserServerService.statisticsApi.readUserInactivity({ Year: firstYear, ChargingStationID: chargingStationContext.getChargingStation().id });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} and charger ${chargingStationContext.getChargingStation().id} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Inactivity data should be ${numberOfUsers * expectedInactivity} hours`
          ).to.be.eql(numberOfUsers * expectedInactivity);
        }
      });

      it('Should see overall sessions data for multiple chargers', async () => {
        const siteContext = tenantContextAll.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
        const siteAreaContext = siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
        const chargingStationContext1 = siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        const chargingStationContext2 = siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
        let adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationTransactions({
          ChargingStationID: `${chargingStationContext1.getChargingStation().id}` + `|${chargingStationContext2.getChargingStation().id}`
        });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for all years and chargers ${chargingStationContext1.getChargingStation().id}` +
          ` and ${chargingStationContext2.getChargingStation().id} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `The number of sessions should be ${numberOfUsers * 2 * numberOfYears * expectedTransactions}`
          ).to.be.eql(numberOfUsers * 2 * numberOfYears * expectedTransactions);
        }
        adminUserListResponse = await adminUserServerService.statisticsApi.readUserTransactions({
          ChargingStationID: `${chargingStationContext1.getChargingStation().id}` + `|${chargingStationContext2.getChargingStation().id}`
        });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for all years and chargers ${chargingStationContext1.getChargingStation().id}` +
          ` and ${chargingStationContext2.getChargingStation().id} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `The number of sessions should be ${numberOfUsers * 2 * numberOfYears * expectedTransactions}`
          ).to.be.eql(numberOfUsers * 2 * numberOfYears * expectedTransactions);
        }
      });

      it('Should see annual pricing data for another user', async () => {
        const user = tenantContextAll.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        let adminUserListResponse = await adminUserServerService.statisticsApi.readChargingStationPricing({ Year: firstYear, UserID: user.id });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} and user ${user.name} (basic user) on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Pricing data should be ${numberOfChargers * expectedPricing} EUR`
          ).to.be.eql(numberOfChargers * expectedPricing);
        }
        adminUserListResponse = await adminUserServerService.statisticsApi.readUserPricing({ Year: firstYear, UserID: user.id });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} and user ${user.name} (basic user) on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(adminUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(adminUserListResponse.data[0]),
            `Usage data should be ${numberOfChargers * expectedPricing} EUR`
          ).to.be.eql(numberOfChargers * expectedPricing);
        }
      });

      it('Should be able to export annual consumption data to file', async () => {
        let adminUserListResponse = await adminUserServerService.statisticsApi.exportStatistics({ Year: firstYear, DataType: 'Consumption', DataCategory: 'C', DataScope: 'month' });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} on data per charging station should not be empty`
        ).not.to.be.empty;
        let objectArray = TestUtils.convertExportFileToObjectArray(adminUserListResponse.data);
        expect(objectArray.length,
          `Number of exported chargers should be ${numberOfChargers}`
        ).to.be.eql(numberOfChargers);
        adminUserListResponse = await adminUserServerService.statisticsApi.exportStatistics({ Year: firstYear, DataType: 'Consumption', DataCategory: 'U', DataScope: 'total' });
        expect(adminUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(adminUserListResponse.data,
          `Query response for year ${firstYear} on data per user should not be empty`
        ).not.to.be.empty;
        objectArray = TestUtils.convertExportFileToObjectArray(adminUserListResponse.data);
        expect(objectArray.length,
          `Number of exported users should be ${numberOfUsers}`
        ).to.be.eql(numberOfUsers);
      });

    });

    describe('Where basic user', () => {

      it('Should see overall consumption data only for own user', async () => {
        let basicUserListResponse = await basicUserServerService.statisticsApi.readChargingStationConsumption({});
        expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(basicUserListResponse.data,
          'Query response for all years on data per charging station should not be empty'
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfYears * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedConsumption);
        }
        basicUserListResponse = await basicUserServerService.statisticsApi.readUserConsumption({});
        expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(basicUserListResponse.data,
          'Query response for all years on data per user should not be empty'
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfYears * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedConsumption);
        }
      });

      it('Should see annual usage data only for own user', async () => {
        let basicUserListResponse = await basicUserServerService.statisticsApi.readChargingStationUsage({ Year: firstYear });
        expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(basicUserListResponse.data,
          `Query response for year ${firstYear} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Usage data should be ${numberOfChargers * expectedUsage} hours`
          ).to.be.eql(numberOfChargers * expectedUsage);
        }
        basicUserListResponse = await basicUserServerService.statisticsApi.readUserUsage({ Year: firstYear });
        expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(basicUserListResponse.data,
          `Query response for year ${firstYear} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Usage data should be ${numberOfChargers * expectedUsage} hours`
          ).to.be.eql(numberOfChargers * expectedUsage);
        }
      });

      it(
        'Should see annual inactivity data of a specific charger only for own user',
        async () => {
          const siteContext = tenantContextAll.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
          const siteAreaContext = siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
          const chargingStationContext = siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
          let basicUserListResponse = await basicUserServerService.statisticsApi.readChargingStationInactivity({ Year: firstYear, ChargingStationID: chargingStationContext.getChargingStation().id });
          expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
          expect(basicUserListResponse.data,
            `Query response for year ${firstYear} and charger ${chargingStationContext.getChargingStation().id} on data per charging station should not be empty`
          ).not.to.be.empty;
          if (Array.isArray(basicUserListResponse.data)) {
            expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
              `Inactivity data should be ${expectedInactivity} hours`
            ).to.be.eql(expectedInactivity);
          }
          basicUserListResponse = await basicUserServerService.statisticsApi.readUserInactivity({ Year: firstYear, ChargingStationID: chargingStationContext.getChargingStation().id });
          expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
          expect(basicUserListResponse.data,
            `Query response for year ${firstYear} and charger ${chargingStationContext.getChargingStation().id} on data per user should not be empty`
          ).not.to.be.empty;
          if (Array.isArray(basicUserListResponse.data)) {
            expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
              `Inactivity data should be ${expectedInactivity} hours`
            ).to.be.eql(expectedInactivity);
          }
        }
      );

      it(
        'Should see annual sessions data of a specific site only for own user',
        async () => {
          const siteContext = tenantContextAll.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
          let basicUserListResponse = await basicUserServerService.statisticsApi.readChargingStationTransactions({ Year: firstYear, SiteID: siteContext.getSite().id });
          expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
          expect(basicUserListResponse.data,
            `Query response for year ${firstYear} and site ${siteContext.getSite().name} on data per charging station should not be empty`
          ).not.to.be.empty;
          if (Array.isArray(basicUserListResponse.data)) {
            expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
              `The number of sessions should be ${numberOfChargers * expectedTransactions}`
            ).to.be.eql(numberOfChargers * expectedTransactions);
          }
          basicUserListResponse = await basicUserServerService.statisticsApi.readUserTransactions({ Year: firstYear, SiteID: siteContext.getSite().id });
          expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
          expect(basicUserListResponse.data,
            `Query response for year ${firstYear} and site ${siteContext.getSite().name} on data per user should not be empty`
          ).not.to.be.empty;
          if (Array.isArray(basicUserListResponse.data)) {
            expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
              `The number of sessions should be ${numberOfChargers * expectedTransactions}`
            ).to.be.eql(numberOfChargers * expectedTransactions);
          }
        }
      );

      it('Should see overall pricing data only for own user', async () => {
        let basicUserListResponse = await basicUserServerService.statisticsApi.readChargingStationPricing({});
        expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(basicUserListResponse.data,
          'Query response for all years on data per charging station should not be empty'
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfYears * expectedPricing} EUR`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedPricing);
        }
        basicUserListResponse = await basicUserServerService.statisticsApi.readUserPricing({});
        expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(basicUserListResponse.data,
          'Query response for all years on data per user should not be empty'
        ).not.to.be.empty;
        if (Array.isArray(basicUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(basicUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfYears * expectedPricing} EUR`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedPricing);
        }
      });

      it('Should be able to export own overall usage data to file', async () => {
        let basicUserListResponse = await basicUserServerService.statisticsApi.exportStatistics({ DataType: 'Usage', DataCategory: 'C', DataScope: 'total' });
        expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(basicUserListResponse.data,
          'Query response for all years on data per charging station should not be empty'
        ).not.to.be.empty;
        let objectArray = TestUtils.convertExportFileToObjectArray(basicUserListResponse.data);
        expect(objectArray.length,
          `Number of exported chargers should be ${numberOfChargers}`
        ).to.be.eql(numberOfChargers);
        basicUserListResponse = await basicUserServerService.statisticsApi.exportStatistics({ DataType: 'Usage', DataCategory: 'U', DataScope: 'total' });
        expect(basicUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(basicUserListResponse.data,
          'Query response for all years on data per user should not be empty'
        ).not.to.be.empty;
        objectArray = TestUtils.convertExportFileToObjectArray(basicUserListResponse.data);
        expect(objectArray.length,
          'Number of exported users should be 1'
        ).to.be.eql(1);
      });

    });

    describe('Where demo user', () => {

      it('Should see annual consumption data for all users', async () => {
        let demoUserListResponse = await demoUserServerService.statisticsApi.readChargingStationConsumption({ Year: firstYear });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfUsers * expectedConsumption} kwH`
          ).to.be.eql(numberOfChargers * numberOfUsers * expectedConsumption);
        }
        demoUserListResponse = await demoUserServerService.statisticsApi.readUserConsumption({ Year: firstYear });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
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
        const siteContext = tenantContextAll.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
        const siteAreaContext = siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
        const chargingStationContext = siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
        let demoUserListResponse = await demoUserServerService.statisticsApi.readChargingStationUsage({ Year: firstYear, ChargingStationID: chargingStationContext.getChargingStation().id });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} and charger ${chargingStationContext.getChargingStation().id} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Usage data should be ${numberOfUsers * expectedUsage} hours`
          ).to.be.eql(numberOfUsers * expectedUsage);
        }
        demoUserListResponse = await demoUserServerService.statisticsApi.readUserUsage({ Year: firstYear, ChargingStationID: chargingStationContext.getChargingStation().id });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
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
        const user = tenantContextAll.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        let demoUserListResponse = await demoUserServerService.statisticsApi.readChargingStationInactivity({ UserID: user.id });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(demoUserListResponse.data,
          `Query response for all years and user ${user.name} (basic user) on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Inactivity data should be ${numberOfChargers * numberOfYears * expectedInactivity} hours`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedInactivity);
        }
        demoUserListResponse = await demoUserServerService.statisticsApi.readUserInactivity({ UserID: user.id });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(demoUserListResponse.data,
          `Query response for all years and user ${user.name} (basic user) on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Inactivity data should be ${numberOfChargers * numberOfYears * expectedInactivity} hours`
          ).to.be.eql(numberOfChargers * numberOfYears * expectedInactivity);
        }
      });

      it('Should see annual sessions data for another user', async () => {
        const user = tenantContextAll.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        let demoUserListResponse = await demoUserServerService.statisticsApi.readChargingStationTransactions({ Year: firstYear, UserID: user.id });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} and user ${user.name} (admin user) on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `The number of sessions should be ${numberOfChargers * expectedTransactions}`
          ).to.be.eql(numberOfChargers * expectedTransactions);
        }
        demoUserListResponse = await demoUserServerService.statisticsApi.readUserTransactions({ Year: firstYear, UserID: user.id });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} and user ${user.name} (admin user) on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `The number of sessions should be ${numberOfChargers * expectedTransactions}`
          ).to.be.eql(numberOfChargers * expectedTransactions);
        }
      });

      it('Should see annual pricing data for all users', async () => {
        let demoUserListResponse = await demoUserServerService.statisticsApi.readChargingStationPricing({ Year: firstYear });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} on data per charging station should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfUsers * expectedPricing} EUR`
          ).to.be.eql(numberOfChargers * numberOfUsers * expectedPricing);
        }
        demoUserListResponse = await demoUserServerService.statisticsApi.readUserPricing({ Year: firstYear });
        expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
        expect(demoUserListResponse.data,
          `Query response for year ${firstYear} on data per user should not be empty`
        ).not.to.be.empty;
        if (Array.isArray(demoUserListResponse.data)) {
          expect(StatisticsApi.calculateTotalsPerMonth(demoUserListResponse.data[0]),
            `Consumption data should be ${numberOfChargers * numberOfUsers * expectedPricing} EUR`
          ).to.be.eql(numberOfChargers * numberOfUsers * expectedPricing);
        }
      });

      it(
        'Should be able to export annual pricing data to file for all users',
        async () => {
          let demoUserListResponse = await demoUserServerService.statisticsApi.exportStatistics({ Year: firstYear, DataType: 'Pricing', DataCategory: 'C', DataScope: 'total' });
          expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
          expect(demoUserListResponse.data,
            `Query response for year ${firstYear} on data per charging station should not be empty`
          ).not.to.be.empty;
          let objectArray = TestUtils.convertExportFileToObjectArray(demoUserListResponse.data);
          expect(objectArray.length,
            `Number of exported chargers should be ${numberOfChargers}`
          ).to.be.eql(numberOfChargers);
          demoUserListResponse = await demoUserServerService.statisticsApi.exportStatistics({ Year: firstYear, DataType: 'Pricing', DataCategory: 'U', DataScope: 'month' });
          expect(demoUserListResponse.status).to.be.eql(StatusCodes.OK);
          expect(demoUserListResponse.data,
            `Query response for year ${firstYear} on data per user should not be empty`
          ).not.to.be.empty;
          objectArray = TestUtils.convertExportFileToObjectArray(demoUserListResponse.data);
          expect(objectArray.length,
            `Number of exported users should be ${numberOfUsers}`
          ).to.be.eql(numberOfUsers);
        }
      );

    });

  });

});
