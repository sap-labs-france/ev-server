const CentralServerService = require('../client/CentralServerService');
import Constants from '../../../src/utils/Constants';
const {
  expect
} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const {
  SITE_CONTEXTS,
  SITE_AREA_CONTEXTS,
  TENANT_CONTEXT_LIST,
  TENANT_SITE_LIST
} = require('./ContextConstants');
const TenantContext = require('./TenantContext');
const SiteContext = require('./SiteContext');
const config = require('../../config');

class ContextProvider {

  constructor() {
    // Create a super admin interface
    this.superAdminCentralServerService = new CentralServerService(null, {email: config.get('superadmin.username'), password: config.get('superadmin.password')});
    this.tenantsContexts = [];
    this.initialized = false;
  }

  async _init() {
    if (!this.initialized) {
      // read all tenants
      this.tenantEntities = (await this.superAdminCentralServerService.tenantApi.readAll({}, {limit: 0, skip:0})).data.result;
    }
    this.initialized = true;
  }

  async prepareContexts(tenantContextNames) {
    await this._init();
    // Prepare list of tenants to create
    let tenantContexts = TENANT_CONTEXT_LIST;
    if (tenantContextNames) {
      if (!Array.isArray(tenantContextNames)) {
        tenantContextNames = [tenantContextNames];
      }
      tenantContexts = tenantContextNames.map((tenantName) => {
        return TENANT_CONTEXT_LIST.find((tenantContext) => {
          tenantContext.tenantName === tenantName;
        });
      });
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
    return await this._tenantEntityContext(this._getTenantContextDef(tenantContextName));
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
    chargingStationList = (await defaultAdminCentralServiceService.chargingStationApi.readAll()).data.result;
    siteAreaList = (await defaultAdminCentralServiceService.siteAreaApi.readAll()).data.result;
    siteList = (await defaultAdminCentralServiceService.siteApi.readAll()).data.result;
    companyList = (await defaultAdminCentralServiceService.companyApi.readAll()).data.result;
    userList = (await defaultAdminCentralServiceService.userApi.readAll()).data.result;
    for (const user of userList) {
      user.password = config.get('admin.password');
      user.centralServerService = new CentralServerService(tenantEntity.subdomain, user);
    }

    // Create tenant context
    const newTenantContext = new TenantContext(tenantContextDef.tenantName, tenantEntity, defaultAdminCentralServiceService);
    this.tenantsContexts.push(newTenantContext);
    newTenantContext.addUsers(userList); // getContext().users = userList;
    newTenantContext.getContext().companies = companyList;

    if (tenantEntity.components && tenantEntity.components.hasOwnProperty(Constants.COMPONENTS.ORGANIZATION) &&
      tenantEntity.components[Constants.COMPONENTS.ORGANIZATION].active) {
      for (const siteContextDef of TENANT_SITE_LIST) {
        const jsonSite = siteList.find((site) => site.name === siteContextDef.name);
        const siteContext = new SiteContext(jsonSite, newTenantContext);
        const siteAreas = siteAreaList.filter((siteArea) => siteContext.getSite().id === siteArea.siteID);
        for (const siteArea of siteAreas) {
          const siteAreaContext = siteContext.addSiteArea(siteArea);
          const chargingStations = chargingStationList.filter((chargingStation) => siteArea.id === chargingStation.siteAreaID);
          for (const chargingStation of chargingStations) {
            siteAreaContext.addChargingStation(chargingStation);
          }
        }
        newTenantContext.addSiteContext(siteContext);
      }
    }
    // Create list of unassigned charging station by creating a dummy site
    const siteContext = new SiteContext({id: 1, name: SITE_CONTEXTS.NO_SITE}, newTenantContext);
    const emptySiteAreaContext = siteContext.addSiteArea({id: 1, name: SITE_AREA_CONTEXTS.NO_SITE});
    const chargingStations = chargingStationList.filter((chargingStation) => !chargingStation.hasOwnProperty('siteAreaID') || !chargingStation.siteAreaID);
    for (const chargingStation of chargingStations) {
      emptySiteAreaContext.addChargingStation(chargingStation);
    }
    newTenantContext.addSiteContext(siteContext);

    return newTenantContext;
  }

  async cleanUpCreatedContent() {
    for (const tenantContext of this.tenantsContexts) {
      await tenantContext.cleanUpCreatedData();
    }
  }

  _getTenantContextDef(tenantContextName, checkValid = true) {
    const tenantContext = TENANT_CONTEXT_LIST.find((context) => {
      return context.tenantName === tenantContextName;
    });
    if (!tenantContext && checkValid) {
      throw 'Unknown context name ' + tenantContextName;
    }
    return tenantContext;
  }

  _getTenantContext(tenantContextName, checkValid = true) {
    const tenantContextDef = this._getTenantContextDef(tenantContextName, checkValid);
    return this.tenantsContexts.find((tenantContext) => {
      return (tenantContext.tenantName === tenantContextName);
    });
  }

}

module.exports = new ContextProvider();
