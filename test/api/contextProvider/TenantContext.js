const Factory = require('../../factories/Factory');
const config = require('../../config');
const OCPPJsonService16 = require('../ocpp/json/OCPPJsonService16');
const OCPPJsonService15 = require('../ocpp/soap/OCPPSoapService15');
const SiteContext = require('./SiteContext');
const {
  TENANT_USER_LIST
} = require('./ContextConstants');

class TenantContext {

  constructor(tenantName, tenant, centralService, ocppRequestHandler) {
    this.tenantName = tenantName;
    this.tenant = tenant;
    this.centralAdminServerService = centralService;
    this.ocpp16 = new OCPPJsonService16(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP16/${this.tenant.id}`, ocppRequestHandler);
    this.ocpp15 = new OCPPJsonService15(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP15/${this.tenant.id}`);
    this.context = {
      companies: [],
      users: [],
      createdUsers: [],
      createdCompanies: [],
      createdSites: [],
      siteContexts: []
    };
  }

  getTenant() {
    return this.tenant;
  }

  getAdminCentralServerService() {
    return this.centralAdminServerService;
  }

  getOCPPService(ocppVersion) {
    if (ocppVersion === '1.6') {
      return this.ocpp16;
    } else if (ocppVersion === '1.5') {
      return this.ocpp15;
    } else {
      throw new Error('unkown ocpp version');
    }
  }

  getContext() {
    return this.context;
  }

  getSiteContexts() {
    return this.context.siteContexts;
  }

  getSiteContext(siteName = null) {
    if (siteName) {
      return this.context.siteContexts.concat(this.context.createdSites).find((siteContext) => {
        return siteContext.getSiteName() === siteName;
      });
    } else {
      return this.context.siteContexts[0]; // by default return the first context
    }
  }

  addSiteContext(siteContext) {
    this.context.siteContexts.push(siteContext);
  }

  async cleanUpCreatedData() {
    for (const site of this.context.siteContexts) {
      await site.cleanUpCreatedData();
    }
    for (const company of this.context.createdCompanies) {
      await this.centralAdminServerService.deleteEntity(this.centralAdminServerService.companyApi, company);
    }
    for (const user of this.context.createdUsers) {
      await this.centralAdminServerService.deleteEntity(this.centralAdminServerService.userApi, user);
    }
    for (const site of this.context.createdSites) {
      // Delegate
      await site.cleanUpCreatedData();
      // Delete
      await this.centralAdminServerService.deleteEntity(this.centralAdminServerService.siteApi, site.getSite());
    }
  }

  getContextUser(params) { // Structure { id = user ID, email = user mail, role = user role, status = user status, assignedToSite = boolean) {
    if (params.id || params.email) {
      return this.context.users.find((user) => user.id === params.id || user.email === params.email);
    } else {
      return this.context.users.find((user) => {
        let conditionMet = null;
        for (const key in params) {
          if (user.hasOwnProperty(key)) {
            if (conditionMet !== null) {
              conditionMet = conditionMet && user[key] === params[key];
            } else {
              conditionMet = user[key] === params[key];
            }
          } else if (key === 'assignedToSite') {
            const userContextDef = TENANT_USER_LIST.find((userList) => userList.id === user.id);
            if (conditionMet !== null) {
              conditionMet = conditionMet && (userContextDef ? params[key] === userContextDef.assignedToSite : false);
            } else {
              conditionMet = (userContextDef ? params[key] === userContextDef.assignedToSite : false);
            }
          }
        }
        return conditionMet;
      });
    }
  }

  async createUser(user = Factory.user.build(), loggedUser = null) {
    const createdUser = await this.centralAdminServerService.createEntity(this.centralAdminServerService.userApi, user);
    this.context.createdUsers.push(createdUser);
    return createdUser;
  }

  async createCompany(company = Factory.company.build(), loggedUser = null) {
    const createdCompany = await this.centralAdminServerService.createEntity(this.centralAdminServerService.companyApi, company);
    this.context.createdCompanies.push(createdCompany);
    return createdCompany;
  }

  async createSite(company, users, site = Factory.site.build({
    companyID: company.id,
    userIDs: users.map(user => user.id)
  }), loggedUser = null) {
    const siteContext = new SiteContext(site.name, this);
    const createdSite = await this.centralAdminServerService.createEntity(this.centralAdminServerService.companySite, site);
    siteContext.setSite(createdSite);
    this.context.siteContexts.push(siteContext);
    return siteContext;
  }

  findSiteContextFromSiteArea(siteArea) {
    return this.getSiteContexts().find((context) => context.siteAreas.find((tmpSiteArea) => siteArea.id === tmpSiteArea.id));
  }

  findSiteContextFromChargingStation(chargingStation) {
    return this.getSiteContexts().find((context) => context.chargingStations.find((tmpChargingStation) => 
      tmpChargingStation.id === chargingStation.id));
  }

  async close() {
    if (this.ocpp16) {
      this.ocpp16.closeConnection();
    }
  }

}

module.exports = TenantContext;