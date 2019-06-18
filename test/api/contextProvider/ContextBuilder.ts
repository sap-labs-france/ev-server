import CentralServerService from'../client/CentralServerService';
import Factory from'../../factories/Factory';
import TenantFactory from'../../factories/TenantFactory';
import UserFactory from'../../factories/UserFactory';
import CONTEXT_CONSTANTS from'./ContextConstants';
import User from'../../../src/entity/User';
import Company from'../../../src/types/Company';
import CompanyStorage from'../../../src/storage/mongodb/CompanyStorage';
import Site from'../../../src/entity/Site';
import SiteArea from'../../../src/entity/SiteArea';
import Tenant from'../../../src/entity/Tenant';
import config from'../../config';
import MongoDBStorage from'../../../src/storage/mongodb/MongoDBStorage';
import TenantContext from'./TenantContext';
import faker from'faker';
import SiteContext from'./SiteContext';
import SiteAreaContext from'./SiteAreaContext';
import ChargingStationContext from'./ChargingStationContext';
import Constants from '../../../src/utils/Constants';

var global = {
  database: null
}

export default class ContextBuilder {

  private superAdminCentralServerService: CentralServerService;
  private tenantsContexts: Array<TenantContext>;
  private initialized: boolean;

  constructor() {
    // Create a super admin interface
    this.superAdminCentralServerService = new CentralServerService(null, {email: config.get('superadmin.username'), password: config.get('superadmin.password')});
    this.tenantsContexts = [];
    // Create MongoDB
    global.database = new MongoDBStorage(config.get('storage'));
    this.initialized = false;
  }

  async _init() {
    if (!this.initialized) {
      // Connect to the the DB
      await global.database.start();
    }
    this.initialized = true;
  }

  async destroy() {
    if (this.tenantsContexts && this.tenantsContexts.length > 0) {
      return setTimeout(() => { // Delay deletion as unit tests are faster than processing
        this.tenantsContexts.forEach(async (tenantContext) => {
          // console.log('DESTROY context ' + tenantContext.getTenant().id + ' ' + tenantContext.getTenant().subdomain);
          await this.superAdminCentralServerService.deleteEntity(this.superAdminCentralServerService.tenantApi, tenantContext.getTenant());
        });
      }, 10000);
    } else {
      // delete all tenants
      for (const tenantContextDef of CONTEXT_CONSTANTS.TENANT_CONTEXT_LIST) {
        const tenantEntity = await Tenant.getTenantByName(tenantContextDef.tenantName);
        if (tenantEntity) {
          await this.superAdminCentralServerService.tenantApi.delete(tenantEntity.getID());
        }
      }
    }
  }

  /**
   * It will first destroy all Unit Test tenants
   * Then it will create new ones with the minimum entities 
   * All definition is coming from ContextConstants.js
   *
   * @memberof ContextBuilder
   */
  async prepareContexts() {
    await this._init();
    await this.destroy();
    // Prepare list of tenants to create
    const tenantContexts = CONTEXT_CONSTANTS.TENANT_CONTEXT_LIST;
    // Build each tenant context
    for (const tenantContextDef of tenantContexts) {
      await this._buildTenantContext(tenantContextDef);
    }
  }

  /**
   * Pirvate method
   * It will build the necessary tenants
   * Precondition: The tenant MUST not exist already in the DB
   * 
   * @param {*} tenantContextDef
   * @returns
   * @memberof ContextBuilder
   */
  async _buildTenantContext(tenantContextDef) {
    // Build component list
    const components = {};
    switch (tenantContextDef.tenantName) {
      case CONTEXT_CONSTANTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: true
          };
        }
        break;
      case CONTEXT_CONSTANTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS:
        // no components
        break;
      case CONTEXT_CONSTANTS.TENANT_CONTEXTS.TENANT_ORGANIZATION:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: (Constants.COMPONENTS[component] === Constants.COMPONENTS.ORGANIZATION)
          };
        }
        break;
      case CONTEXT_CONSTANTS.TENANT_CONTEXTS.TENANT_SIMPLE_PRICING:
      case CONTEXT_CONSTANTS.TENANT_CONTEXTS.TENANT_CONVERGENT_CHARGING:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: (Constants.COMPONENTS[component] === Constants.COMPONENTS.PRICING)
          };
        }
        break;
      case CONTEXT_CONSTANTS.TENANT_CONTEXTS.TENANT_OCPI:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: (Constants.COMPONENTS[component] === Constants.COMPONENTS.OCPI)
          };
        }
        break;
      case CONTEXT_CONSTANTS.TENANT_CONTEXTS.TENANT_FUNDING:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: (Constants.COMPONENTS[component] === Constants.COMPONENTS.REFUND)
          };
        }
        break;
      default:
        throw 'Unknown context name ' + tenantContextDef.context;
    }
    // Check if tenant exist
    let buildTenant:any = {};
    // Create Tenant
    const dummyTenant = TenantFactory.buildTenantCreate();
    dummyTenant.name = tenantContextDef.tenantName;
    dummyTenant.subdomain = tenantContextDef.subdomain;
    buildTenant = await this.superAdminCentralServerService.createEntity(
      this.superAdminCentralServerService.tenantApi, dummyTenant);
    // Update components
    buildTenant.components = components;
    await this.superAdminCentralServerService.updateEntity(
      this.superAdminCentralServerService.tenantApi, buildTenant);

    // Retrieve default admin 
    const existingUserList = (await User.getUsers(buildTenant.id)).result;
    let defaultAdminUser = null;
    // Search existing admin 
    if (existingUserList && Array.isArray(existingUserList)) {
      defaultAdminUser = existingUserList.find((user) => {
        return user.getModel().id === CONTEXT_CONSTANTS.TENANT_USER_LIST[0].id || user.getEMail() === config.get('admin.username') ||
          user.getRole() === 'A';
      });
    }
    if ((defaultAdminUser.getID() !== CONTEXT_CONSTANTS.TENANT_USER_LIST[0].id) || (defaultAdminUser.getStatus() !== 'A')) {
      // It is a different default user so firt delete it
      await defaultAdminUser.delete();
      // Activate user
      defaultAdminUser.setStatus(CONTEXT_CONSTANTS.TENANT_USER_LIST[0].status);
      // Generate the password hash
      const newPasswordHashed = await User.hashPasswordBcrypt(config.get('admin.password'));
      // Update the password
      defaultAdminUser.setPassword(newPasswordHashed);
      // Update the email
      defaultAdminUser.setEMail(config.get('admin.username'));
      // Add a Tag ID
      defaultAdminUser.setTagIDs(CONTEXT_CONSTANTS.TENANT_USER_LIST[0].tagIDs ? CONTEXT_CONSTANTS.TENANT_USER_LIST[0].tagIDs : [faker.random.alphaNumeric(8).toUpperCase()]);
      // Fix id
      defaultAdminUser.getModel().id = CONTEXT_CONSTANTS.TENANT_USER_LIST[0].id;
      await defaultAdminUser.save();
    }

    // Create Central Server Service
    const localCentralServiceService = new CentralServerService(buildTenant.subdomain);

    // Create Tenant component settings
    if (tenantContextDef.componentSettings) {
      for (const setting in tenantContextDef.componentSettings) {
        if (tenantContextDef.componentSettings.hasOwnProperty(setting)) {
          // create new settings
          const settingInput = {
            identifier: setting,
            content: tenantContextDef.componentSettings[setting]
          };
          await localCentralServiceService.createEntity(localCentralServiceService.settingApi,
            settingInput);
        }
      }
    }
    let userListToAssign = null;
    let userList = null;
    // read admin user
    const adminUser = (await localCentralServiceService.getEntityById(
      localCentralServiceService.userApi, defaultAdminUser.getModel(), false)).data;
    userListToAssign = [adminUser]; // default admin is always assigned to site
    userList = [adminUser]; // default admin is always assigned to site
    // Prepare users
    // Skip first entry as it is teh default admin already consider above
    for (let index = 1; index < CONTEXT_CONSTANTS.TENANT_USER_LIST.length; index++) {
      const userDef = CONTEXT_CONSTANTS.TENANT_USER_LIST[index];
      const createUser = UserFactory.build();
      createUser.email = userDef.emailPrefix + defaultAdminUser.getEMail();
      // Update the password
      createUser.passwords.repeatPassword = createUser.passwords.password = config.get('admin.password');
      createUser.role = userDef.role;
      createUser.status = userDef.status;
      createUser.id = userDef.id;
      if (userDef.tagIDs) {
        createUser.tagIDs = userDef.tagIDs;
      }
      const user = new User(buildTenant.id, createUser);
      user.save();
      // const user = await localCentralServiceService.createEntity(
      // localCentralServiceService.userApi, createUser);
      if (userDef.assignedToSite) {
        userListToAssign.push(user.getModel());
      }
      userList.push(user.getModel());
    }
    // Persist tenant context
    const newTenantContext = new TenantContext(tenantContextDef.tenantName, buildTenant, localCentralServiceService, null);
    this.tenantsContexts.push(newTenantContext);
    console.log('CREATE tenant context ' + newTenantContext.getTenant().id +
       ' ' + newTenantContext.getTenant().subdomain);
    newTenantContext.addUsers(userList);
    // Check if Organization is active
    if (buildTenant.components && buildTenant.components.hasOwnProperty(Constants.COMPONENTS.ORGANIZATION) &&
      buildTenant.components[Constants.COMPONENTS.ORGANIZATION].active) {
      // Create the company
      let company = null;
      for (const companyDef of CONTEXT_CONSTANTS.TENANT_COMPANY_LIST) {
        const dummyCompany = Factory.company.build();
        dummyCompany.id = companyDef.id;
        company = (await CompanyStorage.saveCompany(buildTenant.id, dummyCompany));
        newTenantContext.getContext().companies.push(dummyCompany);
      }
      // Build sites/sitearea according to tenant definition
      for (const siteContextDef of CONTEXT_CONSTANTS.TENANT_SITE_LIST) {
        let site = null;
        // Create site
        const siteTemplate = Factory.site.build({
          companyID: siteContextDef.companyID,
          userIDs: userListToAssign.map(user => user.id)
        });
        siteTemplate.name = siteContextDef.name;
        siteTemplate.allowAllUsersToStopTransactions = siteContextDef.allowAllUsersToStopTransactions;
        siteTemplate.autoUserSiteAssignment = siteContextDef.autoUserSiteAssignment;
        siteTemplate.id = siteContextDef.id;
        site = new Site(buildTenant.id, siteTemplate);
        site = (await site.save()).getModel();
        await Site.addUsersToSite(buildTenant.id, site.id, userListToAssign.map(user => user.id));
        const siteContext = new SiteContext(site, newTenantContext);
        newTenantContext.addSiteContext(siteContext);
        // Create site areas of current site
        for (const siteAreaDef of CONTEXT_CONSTANTS.TENANT_SITEAREA_LIST.filter(siteArea => siteArea.siteName === site.name)) {
          const siteAreaTemplate = Factory.siteArea.build();
          siteAreaTemplate.id = siteAreaDef.id;
          siteAreaTemplate.name = siteAreaDef.name;
          siteAreaTemplate.accessControl = siteAreaDef.accessControl;
          siteAreaTemplate.siteID = site.id;
          console.log(siteAreaTemplate.name);
          let siteArea = new SiteArea(buildTenant.id, siteAreaTemplate);
          siteArea = (await siteArea.save()).getModel();
          // siteContext.siteAreas.push(siteArea);
          const siteAreaContext = new SiteAreaContext(siteArea, newTenantContext);
          siteContext.addSiteArea(siteAreaContext);
          const relevantCS = CONTEXT_CONSTANTS.TENANT_CHARGINGSTATION_LIST.filter(chargingStation =>
            chargingStation.siteAreaNames && chargingStation.siteAreaNames.includes(siteArea.getName()) === true);
          // Create Charging Station for site area
          for (const chargingStationDef of relevantCS) {
            const chargingStationTemplate = Factory.chargingStation.build();
            chargingStationTemplate.id = chargingStationDef.baseName + '-' + siteArea.getName();
            console.log(chargingStationTemplate.id);
            await newTenantContext.createChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, siteArea);
          }
        }
      }
    }
    // create unassigned Charging station
    // const siteContext = new SiteContext(SITE_CONTEXTS.NO_SITE);
    // newTenantContext.addSiteContext(siteContext);
    const relevantCS = CONTEXT_CONSTANTS.TENANT_CHARGINGSTATION_LIST.filter(chargingStation =>
      chargingStation.siteAreaNames === null);
    // Create Charging Station for site area
    for (const chargingStationDef of relevantCS) {
      const chargingStationTemplate = Factory.chargingStation.build();
      chargingStationTemplate.id = chargingStationDef.baseName;
      console.log(chargingStationTemplate.id);
      await newTenantContext.createChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, null);
    }
    return newTenantContext;
  }

}