import chai, { expect } from 'chai';

import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import { OCPPStatus } from '../../src/types/ocpp/OCPPClient';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);


describe('Template for Dev Unit Test', function() {
  jest.setTimeout(10000); // Not mandatory will automatically stop the unit test after that period of time

  beforeAll(async () => {
    chai.config.includeStack = true;
    // Used to prepare data beforeAll the whole test chain is started
    await ContextProvider.defaultInstance.prepareContexts();
  });

  afterEach(async () => {
    // Should be called after each UT to clean up created data
    await ContextProvider.defaultInstance.cleanUpCreatedContent();
  });

  afterAll(async () => {
    // Can be called at the end to ensure proper data clean up
    // ContextProvider.cleanUpCreatedContent();
  });

  describe('Usage of tenant context with all components', () => {
    it('Basic charging station transaction', async () => {
      const tenantContextAll = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      const user = tenantContextAll.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
      const siteContext = tenantContextAll.getSiteContext(ContextDefinition.SITE_CONTEXTS.SITE_BASIC);
      const siteAreaContext = siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
      const chargingStationContext = siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP15);
      const response = await chargingStationContext.startTransaction(1, user.tags[0].id, 0, moment());
      expect(response).to.be.transactionValid;
      const userCentralService = tenantContextAll.getUserCentralServerService(ContextDefinition.USER_CONTEXTS.BASIC_USER);
      const tenantListResponse = await userCentralService.transactionApi.readAllActive({});
    });

    it('usage of non assigned CS', async () => {
      const tenantContextAll = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
      const user = tenantContextAll.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
      const siteContext = tenantContextAll.getSiteContext(ContextDefinition.SITE_CONTEXTS.NO_SITE);
      const siteAreaContext = siteContext.getSiteAreaContext(ContextDefinition.SITE_AREA_CONTEXTS.NO_SITE);
      const chargingStationContext = siteAreaContext.getChargingStationContext(ContextDefinition.CHARGING_STATION_CONTEXTS.UNASSIGNED_OCPP16);
      const response = await chargingStationContext.startTransaction(1, user.tags[0].id, 0, moment());
      expect(response).to.be.transactionStatus(OCPPStatus.REJECTED);
    });

  });

  describe('usage of non assigned CS', () => {
  });
});
