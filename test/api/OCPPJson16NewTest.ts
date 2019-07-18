import chai, { expect } from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import responseHelper from '../helpers/responseHelper';
import CentralServerService from './client/CentralServerService';
import CONTEXTS from './contextProvider/ContextConstants';
import ContextProvider from './contextProvider/ContextProvider';

chai.use(chaiDatetime);
chai.use(chaiSubset);
chai.use(responseHelper);

describe('OCPP 1.6 JSON Tests (New)', function () {
  this.timeout(30000); // Will automatically stop the unit test after that period of time

  let tenantContextNothing: any;
  let adminUserServerServiceNothing: CentralServerService;

  let tenantContextAll: any;
  //  let basicUserServerService: CentralServerService;
  let adminUserServerService: CentralServerService;
  //  let demoUserServerService: CentralServerService;


  before(async () => {
    chai.config.includeStack = true;

    // Prepare data before the whole test chain is started
    await ContextProvider.DefaultInstance.prepareContexts();

    tenantContextNothing = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS);
    let adminUser = tenantContextNothing.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
    adminUserServerServiceNothing = new CentralServerService(tenantContextNothing.getTenant().subdomain, adminUser);

    tenantContextAll = await ContextProvider.DefaultInstance.getTenantContext(CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS);
    //  const basicUser = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.BASIC_USER);
    //  basicUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, basicUser);
    adminUser = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.DEFAULT_ADMIN);
    adminUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, adminUser);
    //    const demoUser = tenantContextAll.getUserContext(CONTEXTS.USER_CONTEXTS.DEMO_USER);
    //   demoUserServerService = new CentralServerService(tenantContextAll.getTenant().subdomain, demoUser);

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
    it('Charging Station should set both of its connectors to Available', async () => {
      const siteContext = tenantContextAll.getSiteContext(CONTEXTS.SITE_CONTEXTS.SITE_BASIC);
      const siteAreaContext = siteContext.getSiteAreaContext(CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
      const chargingStationContext = siteAreaContext.getChargingStationContext(CONTEXTS.CHARGING_STATION_CONTEXTS.ASSIGNED_OCPP16);
      const chargingStationConnector = {
        connectorId: 1,
        status: 'Available',
        errorCode: 'NoError',
        timestamp: new Date().toISOString()
      };
      let response = await chargingStationContext.setConnectorStatus(chargingStationConnector.connectorId, chargingStationConnector.status, new Date());
      expect(response.data).to.eql({});
      chargingStationConnector.connectorId = 2;
      response = await chargingStationContext.setConnectorStatus(chargingStationConnector.connectorId, chargingStationConnector.status, new Date());
      expect(response.data).to.eql({});
      // Attention: connector status is always 'Unavailable', if too much time has passed since last heartbeat!!
      response = await chargingStationContext.sendHeartbeat();
      // expect(response.data).to.have.property('currentTime');
      // Now we can test the connector status!
      // The next method should be split to CSContext (call) and here (expect):
      await CentralServerService.DefaultInstance.chargingStationApi.checkConnector(
        chargingStationContext.getChargingStation(), chargingStationConnector.connectorId, chargingStationConnector);
      chargingStationConnector.connectorId = 1;
      await CentralServerService.DefaultInstance.chargingStationApi.checkConnector(
        chargingStationContext.getChargingStation(), chargingStationConnector.connectorId, chargingStationConnector);
        response = await chargingStationContext.readChargingStation();
        expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(chargingStationContext.getChargingStation().id);
    // Check Connector
    const foundChargingStation = response.data;
    // Check
    expect(foundChargingStation.connectors).to.not.be.null;
    expect(foundChargingStation.connectors[0]).to.include({status: chargingStationConnector.status, errorCode: chargingStationConnector.errorCode});

    });



  });

});
