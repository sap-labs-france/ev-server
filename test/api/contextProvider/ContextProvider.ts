import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import config from '../../config';
import faker from 'faker';
import CentralServerService from '../client/CentralServerService';
import Constants from '../../../src/utils/Constants';
import CONTEXTS from './ContextConstants';
import Factory from '../../factories/Factory';
import SiteContext from './SiteContext';
import TenantContext from './TenantContext';

chai.use(chaiSubset);

export default class ContextProvider {

  private static _defaultInstance = new ContextProvider();

  private superAdminCentralServerService: CentralServerService;
  private tenantsContexts: TenantContext[];
  private initialized: boolean;
  private tenantEntities: any;

  constructor() {
    // Create a super admin interface
    this.superAdminCentralServerService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    this.tenantsContexts = [];
    this.initialized = false;
  }

  public static get DefaultInstance(): ContextProvider {
    if (!ContextProvider._defaultInstance) {
      ContextProvider._defaultInstance = new ContextProvider();
    }
    return ContextProvider._defaultInstance;
  }

  async _init() {
    if (!this.initialized) {
      // Read all tenants
      this.tenantEntities = (await this.superAdminCentralServerService.tenantApi.readAll({}, Constants.DB_PARAMS_MAX_LIMIT)).data.result;
    }
    this.initialized = true;
  }

  async prepareContexts(tenantContextNames?: string[]) {
    await this._init();
    // Prepare list of tenants to create
    let tenantContexts = CONTEXTS.TENANT_CONTEXT_LIST;
    if (tenantContextNames) {
      if (!Array.isArray(tenantContextNames)) {
        tenantContextNames = [tenantContextNames];
      }
      tenantContexts = tenantContextNames.map((tenantName) => CONTEXTS.TENANT_CONTEXT_LIST.find((tenantContext) => {
        tenantContext.tenantName === tenantName;
      }));
    }
    // Build each tenant context
    for (const tenantContextDef of tenantContexts) {
      await this._tenantEntityContext(tenantContextDef);
    }
  }

  async getTenantContext(tenantContextName) {
    await this._init();
    const tenantContext = this._getTenantContext(tenantContextName);

    // Check if already loaded
    if (tenantContext) {
      return tenantContext;
    }

    // Not find build context
    return this._tenantEntityContext(this._getTenantContextDef(tenantContextName));
  }

  async _tenantEntityContext(tenantContextDef) {
    // Check if tenant exist
    const tenantEntity = this.tenantEntities.find((tenant) => tenant.name === tenantContextDef.tenantName);
    expect(tenantEntity).to.not.be.empty;

    // Create Central Server Service for admin user defined in config
    const defaultAdminCentralServiceService = new CentralServerService(tenantEntity.subdomain);
    let chargingStationList = null;
    let siteAreaList = null;
    let siteList = null;
    let companyList = null;
    let userList = null;
    // Read all existing entities
    if (tenantEntity.components && tenantEntity.components[Constants.COMPONENTS.ORGANIZATION] &&
      tenantEntity.components[Constants.COMPONENTS.ORGANIZATION].active) {
      siteAreaList = (await defaultAdminCentralServiceService.siteAreaApi.readAll({}, { limit: 0, skip: 0 })).data.result;
      siteList = (await defaultAdminCentralServiceService.siteApi.readAll({}, { limit: 0, skip: 0 })).data.result;
      companyList = (await defaultAdminCentralServiceService.companyApi.readAll({}, { limit: 0, skip: 0 })).data.result;
      chargingStationList = (await defaultAdminCentralServiceService.chargingStationApi.readAll({}, Constants.DB_PARAMS_MAX_LIMIT)).data.result;
    } else {
      chargingStationList = (await defaultAdminCentralServiceService.chargingStationApi.readAll({ WithNoSiteArea: true }, Constants.DB_PARAMS_MAX_LIMIT)).data.result;
    }
    userList = (await defaultAdminCentralServiceService.userApi.readAll({}, { limit: 0, skip: 0 })).data.result;
    for (const user of userList) {
      user.password = config.get('admin.password');
      user.centralServerService = new CentralServerService(tenantEntity.subdomain, user);
    }

    // Create tenant context
    const newTenantContext = new TenantContext(tenantContextDef.tenantName, tenantEntity, '', defaultAdminCentralServiceService, null);
    this.tenantsContexts.push(newTenantContext);
    newTenantContext.addUsers(userList); // pragma getContext().users = userList;
    newTenantContext.getContext().companies = companyList;

    if (tenantEntity.components && tenantEntity.components[Constants.COMPONENTS.ORGANIZATION] &&
      tenantEntity.components[Constants.COMPONENTS.ORGANIZATION].active) {
      for (const siteContextDef of CONTEXTS.TENANT_SITE_LIST) {
        const jsonSite = siteList.find((site) => site.name === siteContextDef.name);
        const siteContext = new SiteContext(jsonSite, newTenantContext);
        const siteAreas = siteAreaList.filter((siteArea) => siteContext.getSite().id === siteArea.siteID);
        for (const siteArea of siteAreas) {
          const siteAreaContext = siteContext.addSiteArea(siteArea);
          const chargingStations = chargingStationList.filter((chargingStation) => siteArea.id === chargingStation.siteAreaID);
          for (const chargingStation of chargingStations) {
            await siteAreaContext.addChargingStation(chargingStation);
          }
        }
        newTenantContext.addSiteContext(siteContext);
      }
    }
    // Create list of unassigned charging stations
    const chargingStations = chargingStationList.filter((chargingStation) => !chargingStation.siteAreaID);
    for (const chargingStation of chargingStations) {
      await newTenantContext.addChargingStation(chargingStation);
    }

    const registrationToken = faker.random.alphaNumeric(10);
    const unregisteredChargingStation15 = await Factory.chargingStation.build({ id: CONTEXTS.CHARGING_STATION_CONTEXTS.UNREGISTERED_OCPP15, ocppVersion: '1.5' });
    await newTenantContext.addChargingStation(unregisteredChargingStation15, registrationToken);
    const unregisteredChargingStation16 = await Factory.chargingStation.build({ id: CONTEXTS.CHARGING_STATION_CONTEXTS.UNREGISTERED_OCPP16, ocppVersion: '1.6' });
    await newTenantContext.addChargingStation(unregisteredChargingStation16, registrationToken);

    return newTenantContext;
  }

  async cleanUpCreatedContent() {
    for (const tenantContext of this.tenantsContexts) {
      await tenantContext.cleanUpCreatedData();
    }
  }

  _getTenantContextDef(tenantContextName, checkValid = true) {
    const tenantContext = CONTEXTS.TENANT_CONTEXT_LIST.find((context) => context.tenantName === tenantContextName);
    if (!tenantContext && checkValid) {
      throw new Error('Unknown context name ' + tenantContextName);
    }
    return tenantContext;
  }

  _getTenantContext(tenantContextName, checkValid = true) {
    const tenantContextDef = this._getTenantContextDef(tenantContextName, checkValid);
    return this.tenantsContexts.find((tenantContext) => (tenantContext.getTenant().name === tenantContextName));
  }

}
