import chai, { expect } from 'chai';
import config from '../../config';
import faker from 'faker';
import CentralServerService from '../client/CentralServerService';
import ChargingStationContext from './ChargingStationContext';
import CONTEXTS from './ContextConstants';
import Factory from '../../factories/Factory';
import OCPPJsonService16 from '../ocpp/json/OCPPJsonService16';
import OCPPJsonService15 from '../ocpp/soap/OCPPSoapService15';
import SiteAreaContext from './SiteAreaContext';
import SiteContext from './SiteContext';
import Tenant from '../../types/Tenant';
import OCPPService from '../ocpp/OCPPService';

export default class TenantContext {

  private tenantName: string;
  private tenant: Tenant;
  private centralAdminServerService: CentralServerService;
  private ocpp16: OCPPJsonService16;
  private ocpp15: OCPPJsonService15;
  private ocppRequestHandler: any;
  private context: any;

  constructor(tenantName, tenant: Tenant, token, centralService, ocppRequestHandler) {
    this.tenantName = tenantName;
    this.tenant = tenant;
    this.centralAdminServerService = centralService;
    this.ocppRequestHandler = ocppRequestHandler;
    this.context = {
      companies: [],
      users: [],
      siteContexts: [],
      chargingStations: [],
      createdUsers: [],
      createdCompanies: [],
      createdSites: [],
      createdSiteAreas: [],
      createdChargingStations: []
    };
  }

  async initialize(token: string = null) {
    if (!token) {
      token = await this.createRegistrationToken();
    }
    this.ocpp16 = new OCPPJsonService16(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP16/${this.tenant.id}/${token}`, this.ocppRequestHandler);
    this.ocpp15 = new OCPPJsonService15(`${config.get('ocpp.soap.scheme')}://${config.get('ocpp.soap.host')}:${config.get('ocpp.soap.port')}/OCPP15?TenantID=${this.tenant.id}%26Token=${token}`);
  }

  getTenant() {
    return this.tenant;
  }

  getAdminCentralServerService() {
    return this.centralAdminServerService;
  }

  getUserCentralServerService(params) {
    const user = this.getUserContext(params);
    return user.centralServerService;
  }

  async getOCPPService(ocppVersion: string, token: string = null): Promise<OCPPService> {
    if (!this.ocpp15 || !this.ocpp16 || token) {
      await this.initialize(token);
    }
    if (ocppVersion === '1.6') {
      return this.ocpp16;
    } else if (ocppVersion === '1.5') {
      return this.ocpp15;
    }
    throw new Error('unknown ocpp version');
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
    }
    return this.context.siteContexts[0]; // By default return the first context
  }

  addSiteContext(siteContext) {
    this.context.siteContexts.push(siteContext);
  }

  getChargingStations() {
    return this.context.chargingStations;
  }

  getChargingStation(chargingStationID) {
    // Search in context list
    return this.context.chargingStations.find((chargingStationContext) => {
      return chargingStationContext.getChargingStation().id === chargingStationID;
    });
  }

  getChargingStationContext(chargingStationContext) {
    // Search in context list
    return this.context.chargingStations.find((chargingStation) => {
      return chargingStation.getChargingStation().id.startsWith(chargingStationContext);
    });
  }

  async addChargingStation(chargingStation, registrationToken?: string) {
    const chargingStationContext = new ChargingStationContext(chargingStation, this);
    await chargingStationContext.initialize(registrationToken);
    this.context.chargingStations.push(chargingStationContext);
  }

  async cleanUpCreatedData() {
    // Clean up charging stations
    for (const chargingStation of this.context.createdChargingStations) {
      // Delegate
      await chargingStation.cleanUpCreatedData();
      // Delete CS
      await this.centralAdminServerService.deleteEntity(this.centralAdminServerService.chargingStationApi, chargingStation, false);
    }
    // Clean up site areas
    for (const siteArea of this.context.createdSiteAreas) {
      // Delegate
      await siteArea.cleanUpCreatedData();
      // Delete
      await this.getAdminCentralServerService().deleteEntity(this.getAdminCentralServerService().siteAreaApi, siteArea.getSiteArea(), false);
    }
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

  getUserContext(params) { // Structure { id = user ID, email = user mail, role = user role, status = user status, assignedToSite = boolean) {
    if (params.id || params.email) {
      return this.context.users.find((user) => {
        return user.id === params.id || user.email === params.email;
      });
    }
    return this.context.users.find((user) => {
      let conditionMet = null;
      for (const key in params) {
        const userContextDef = CONTEXTS.TENANT_USER_LIST.find((userList) => {
          return userList.id === user.id;
        });
        if (user.hasOwnProperty(key)) {
          if (conditionMet !== null) {
            conditionMet = conditionMet && user[key] === params[key];
          } else {
            conditionMet = user[key] === params[key];
          }
        } else if (key === 'assignedToSite') {
          if (conditionMet !== null) {
            conditionMet = conditionMet && (userContextDef ? params[key] === userContextDef.assignedToSite : false);
          } else {
            conditionMet = (userContextDef ? params[key] === userContextDef.assignedToSite : false);
          }
        } else if (key === 'withTagIDs') {
          if (conditionMet !== null) {
            conditionMet = conditionMet && (params[key] ? user.hasOwnProperty('tagIDs') && Array.isArray(user.tagIDs) && user.tagIDs.length > 0 :
              (user.hasOwnProperty('tagIDs') ? user.tagIDs.length === 0 : true));
          } else {
            conditionMet = (params[key] ? user.hasOwnProperty('tagIDs') && Array.isArray(user.tagIDs) && user.tagIDs.length > 0 :
              (user.hasOwnProperty('tagIDs') ? user.tagIDs.length === 0 : true));
          }
        }
      }
      return conditionMet;
    });

  }

  /**
   * Add default context user
   * Do not user for newly created users
   * @param {*} users
   * @memberof TenantContext
   */
  addUsers(users) {
    for (const user of users) {
      if (!user.hasOwnProperty('password')) {
        user.password = config.get('admin.password');
      }
      if (!user.hasOwnProperty('centralServerService')) {
        user.centralServerService = new CentralServerService(this.tenant.subdomain, user);
      }
      this.context.users.push(user);
    }
  }

  async createUser(user = Factory.user.build(), loggedUser = null) {
    const createdUser = await this.centralAdminServerService.createEntity(this.centralAdminServerService.userApi, user);
    if (!createdUser.hasOwnProperty('password')) {
      createdUser.password = config.get('admin.password');
    }
    if (!createdUser.hasOwnProperty('centralServerService')) {
      createdUser.centralServerService = new CentralServerService(this.tenant.subdomain, createdUser);
    }
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
    userIDs: users.map((user) => {
      return user.id;
    })
  }), loggedUser = null) {
    const siteContext = new SiteContext(site.name, this);
    const createdSite = await this.centralAdminServerService.createEntity(this.centralAdminServerService.siteApi, site);
    siteContext.setSite(createdSite);
    this.context.siteContexts.push(siteContext);
    return siteContext;
  }

  async createSiteArea(site, chargingStations, siteArea) {
    siteArea.siteID = (site && site.id ? (!siteArea.siteID || siteArea.siteID !== site.id ? site.id : siteArea.siteID) : null);
    siteArea.chargeBoxIDs = (Array.isArray(chargingStations) && (!siteArea.chargeBoxIDs || siteArea.chargeBoxIDs.length === 0) ? chargingStations.map((chargingStation) => {
      return chargingStation.id;
    }) : []);
    const createdSiteArea = await this.centralAdminServerService.createEntity(this.centralAdminServerService.siteAreaApi, siteArea);
    this.context.createdSiteAreas.push(new SiteAreaContext(createdSiteArea, this));
    return createdSiteArea;
  }

  async createChargingStation(ocppVersion, chargingStation = Factory.chargingStation.build({
    id: faker.random.alphaNumeric(12)
  }), connectorsDef = null, siteArea = null) {
    const ocppService = await this.getOCPPService(ocppVersion);
    const response = await ocppService.executeBootNotification(
      chargingStation.id, chargingStation);
    // Check
    expect(response.data).to.not.be.null;
    expect(response.data.status).to.eql('Accepted');
    expect(response.data).to.have.property('currentTime');
    const createdChargingStation = await this.getAdminCentralServerService().getEntityById(
      this.getAdminCentralServerService().chargingStationApi, chargingStation);
    chargingStation.connectors = [];
    for (let i = 0; i < (connectorsDef ? connectorsDef.length : 2); i++) {
      createdChargingStation.connectors[i] = {
        connectorId: i + 1,
        status: (connectorsDef && connectorsDef.status ? connectorsDef.status : 'Available'),
        errorCode: (connectorsDef && connectorsDef.errorCode ? connectorsDef.errorCode : 'NoError'),
        timestamp: (connectorsDef && connectorsDef.timestamp ? connectorsDef.timestamp : new Date().toISOString()),
        type: (connectorsDef && connectorsDef.type ? connectorsDef.type : 'U'),
        power: (connectorsDef && connectorsDef.power ? connectorsDef.power : 22170)
      };
    }
    for (const connector of createdChargingStation.connectors) {
      const responseNotif = await ocppService.executeStatusNotification(createdChargingStation.id, connector);
    }
    if (siteArea) {
      // Assign to Site Area
      createdChargingStation.siteArea = siteArea;
      await this.getAdminCentralServerService().updateEntity(
        this.getAdminCentralServerService().chargingStationApi, createdChargingStation);
    }
    const createdCS = new ChargingStationContext(createdChargingStation, this);
    await createdCS.initialize();
    this.context.createdChargingStations.push(createdCS);
    return createdCS;
  }

  async createRegistrationToken(siteAreaID: string = null): Promise<string> {
    const registrationTokenResponse = await this.centralAdminServerService.registrationApi.create({siteAreaID: siteAreaID});
    expect(registrationTokenResponse.status).eq(200);
    expect(registrationTokenResponse.data).not.null;
    expect(registrationTokenResponse.data.id).not.null;
    return registrationTokenResponse.data.id;
  }

  findSiteContextFromSiteArea(siteArea) {
    return this.getSiteContexts().find((context) => {
      return context.siteAreas.find((tmpSiteArea) => {
        return siteArea.id === tmpSiteArea.id;
      });
    });
  }

  findSiteContextFromChargingStation(chargingStation) {
    return this.getSiteContexts().find((context) => {
      return context.chargingStations.find((tmpChargingStation) => {
        return tmpChargingStation.id === chargingStation.id;
      });
    });
  }

  async close() {
    if (this.ocpp16) {
      this.ocpp16.closeConnection();
    }
  }

}
