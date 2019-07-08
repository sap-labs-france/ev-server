import config from '../../config';
import faker from 'faker';
import moment from 'moment';
import CentralServerService from '../client/CentralServerService';
import CompanyStorage from '../../../src/storage/mongodb/CompanyStorage';
import Constants from '../../../src/utils/Constants';
import CONTEXTS from './ContextConstants';
import Factory from '../../factories/Factory';
import global from '../../../src/types/GlobalType';
import MongoDBStorage from '../../../src/storage/mongodb/MongoDBStorage';
import Site from '../../../src/types/Site';
import SiteAreaContext from './SiteAreaContext';
import SiteAreaStorage from '../../../src/storage/mongodb/SiteAreaStorage';
import SiteContext from './SiteContext';
import SiteStorage from '../../../src/storage/mongodb/SiteStorage';
import Tenant from '../../../src/entity/Tenant';
import TenantContext from './TenantContext';
import TenantFactory from '../../factories/TenantFactory';
import User from '../../../src/types/User';
import UserFactory from '../../factories/UserFactory';
import UserStorage from '../../../src/storage/mongodb/UserStorage';
import UserService from '../../../src/server/rest/service/UserService';

export default class ContextBuilder {

  private superAdminCentralServerService: CentralServerService;
  private tenantsContexts: TenantContext[];
  private initialized: boolean;

  constructor() {
    // Create a super admin interface
    this.superAdminCentralServerService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
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
          // pragma console.log('DESTROY context ' + tenantContext.getTenant().id + ' ' + tenantContext.getTenant().subdomain);
          await this.superAdminCentralServerService.deleteEntity(this.superAdminCentralServerService.tenantApi, tenantContext.getTenant());
        });
      }, 10000);
    }
    // Delete all tenants
    for (const tenantContextDef of CONTEXTS.TENANT_CONTEXT_LIST) {
      const tenantEntity = await Tenant.getTenantByName(tenantContextDef.tenantName);
      if (tenantEntity) {
        await this.superAdminCentralServerService.tenantApi.delete(tenantEntity.getID());
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
    const tenantContexts = CONTEXTS.TENANT_CONTEXT_LIST;
    // Build each tenant context
    for (const tenantContextDef of tenantContexts) {
      await this._buildTenantContext(tenantContextDef);
    }
  }

  /**
   * Private method
   * It will build the necessary tenants
   * Precondition: The tenant MUST not exist already in the DB
   *
   * @param {*} tenantContextDef
   * @returns
   * @memberof ContextBuilder
   */
  async _buildTenantContext(tenantContextDef: any) {
    // Build component list
    const components = {};
    if (tenantContextDef.componentSettings) {
      for (const component in Constants.COMPONENTS) {
        const componentName = Constants.COMPONENTS[component];
        if (tenantContextDef.componentSettings.hasOwnProperty(componentName)) {
          components[componentName] = {
            active: true
          };
          if (tenantContextDef.componentSettings[componentName].hasOwnProperty('type')) {
            components[componentName]['type'] = tenantContextDef.componentSettings[componentName].type;
          }
        }
      }
    }
    // Check if tenant exist
    const existingTenant = await Tenant.getTenant(tenantContextDef.id);
    if (existingTenant) {
      console.log(`Tenant ${tenantContextDef.id} already exist with name ${existingTenant.getName()}. Please run a destroy context`);
      throw 'Tenant id exist already';

    }
    let buildTenant: any = {};
    // Create Tenant
    const dummyTenant = TenantFactory.buildTenantCreate();
    dummyTenant.name = tenantContextDef.tenantName;
    dummyTenant.subdomain = tenantContextDef.subdomain;
    dummyTenant.id = tenantContextDef.id;
    buildTenant = await this.superAdminCentralServerService.createEntity(
      this.superAdminCentralServerService.tenantApi, dummyTenant);
    // Update components
    buildTenant.components = components;
    await this.superAdminCentralServerService.updateEntity(
      this.superAdminCentralServerService.tenantApi, buildTenant);
    console.log('CREATE tenant context ' + buildTenant.id +
      ' ' + buildTenant.subdomain);
    // Retrieve default admin
    const existingUserList = (await UserStorage.getUsers(buildTenant.id, {}, {limit: 0, skip: 0})).result;
    let defaultAdminUser: User = null;
    // Search existing admin
    if (existingUserList && Array.isArray(existingUserList)) {
      defaultAdminUser = existingUserList.find((user) => {
        return user.id === CONTEXTS.TENANT_USER_LIST[0].id || user.email === config.get('admin.username') ||
          user.role === 'A';
      });
    }
    if ((defaultAdminUser.id !== CONTEXTS.TENANT_USER_LIST[0].id) || (defaultAdminUser.status !== 'A')) {
      // It is a different default user so firt delete it
      await UserStorage.deleteUser(buildTenant.id, defaultAdminUser.id);
      // Activate user
      defaultAdminUser.status = CONTEXTS.TENANT_USER_LIST[0].status;
      // Generate the password hash
      const newPasswordHashed = await UserService.hashPasswordBcrypt(config.get('admin.password'));
      // Update the password
      defaultAdminUser.password = newPasswordHashed;
      // Update the email
      defaultAdminUser.email = config.get('admin.username');
      // Add a Tag ID
      defaultAdminUser.tagIDs = CONTEXTS.TENANT_USER_LIST[0].tagIDs ? CONTEXTS.TENANT_USER_LIST[0].tagIDs : [faker.random.alphaNumeric(8).toUpperCase()];
      // Fix id
      defaultAdminUser.id = CONTEXTS.TENANT_USER_LIST[0].id;
      await UserStorage.saveUser(buildTenant.id, defaultAdminUser);
    }

    // Create Central Server Service
    const localCentralServiceService: CentralServerService = new CentralServerService(buildTenant.subdomain);

    // Create Tenant component settings
    if (tenantContextDef.componentSettings) {
      console.log(`settings in tenant ${buildTenant.name} as ${JSON.stringify(tenantContextDef.componentSettings)}`);
      const allSettings: any = await localCentralServiceService.settingApi.readAll({}, { limit: 0, skip: 0 });
      for (const setting in tenantContextDef.componentSettings) {
        let foundSetting: any = null;
        if (allSettings && allSettings.data && allSettings.data.result && allSettings.data.result.length > 0) {
          foundSetting = allSettings.data.result.find((existingSetting) => {
            return existingSetting.identifier === setting;
          });
        }
        if (!foundSetting) {
          // Create new settings
          const settingInput = {
            identifier: setting,
            content: tenantContextDef.componentSettings[setting].content
          };
          console.log(`CREATE settings for ${setting} in tenant ${buildTenant.name}`);
          const response = await localCentralServiceService.createEntity(localCentralServiceService.settingApi,
            settingInput);
        } else {
          console.log(`UPDATE settings for ${setting} in tenant ${buildTenant.name}`);
          foundSetting.content = tenantContextDef.componentSettings[setting].content;
          const response = await localCentralServiceService.updateEntity(localCentralServiceService.settingApi,
            foundSetting);
        }
      }
    }
    let userListToAssign: User[] = null;
    let userList: User[] = null;
    // Read admin user
    const adminUser: User = (await localCentralServiceService.getEntityById(
      localCentralServiceService.userApi, defaultAdminUser, false)).data;
    userListToAssign = [adminUser]; // Default admin is always assigned to site
    userList = [adminUser]; // Default admin is always assigned to site
    // Prepare users
    // Skip first entry as it is the default admin already consider above
    for (let index = 1; index < CONTEXTS.TENANT_USER_LIST.length; index++) {
      const userDef = CONTEXTS.TENANT_USER_LIST[index];
      const createUser = UserFactory.build();
      createUser.email = userDef.emailPrefix + defaultAdminUser.email;
      // Update the password
      const newPasswordHashed = await UserService.hashPasswordBcrypt(config.get('admin.password'));
      createUser.password = newPasswordHashed;
      createUser.role = userDef.role;
      createUser.status = userDef.status;
      createUser.id = userDef.id;
      if (userDef.tagIDs) {
        createUser.tagIDs = userDef.tagIDs;
      }
      const user: User = createUser;
      UserStorage.saveUser(buildTenant.id, user);
      if (userDef.assignedToSite) {
        userListToAssign.push(user);
      }
      // Set back password to clear value for login/logout
      const userModel = user;
      (userModel as any).passwordClear = config.get('admin.password'); // TODO ?
      userList.push(userModel);
    }
    // Persist tenant context
    const newTenantContext = new TenantContext(tenantContextDef.tenantName, buildTenant, localCentralServiceService, null);
    this.tenantsContexts.push(newTenantContext);
    newTenantContext.addUsers(userList);
    // Check if Organization is active
    if (buildTenant.components && buildTenant.components.hasOwnProperty(Constants.COMPONENTS.ORGANIZATION) &&
      buildTenant.components[Constants.COMPONENTS.ORGANIZATION].active) {
      // Create the company
      let company = null;
      for (const companyDef of CONTEXTS.TENANT_COMPANY_LIST) {
        const dummyCompany: any = Factory.company.build();
        dummyCompany.id = companyDef.id;
        dummyCompany.createdBy = { id : adminUser.id };
        dummyCompany.createdOn = moment().toISOString();
        company = await CompanyStorage.saveCompany(buildTenant.id, dummyCompany);
        newTenantContext.getContext().companies.push(dummyCompany);
      }
      // Build sites/sitearea according to tenant definition
      for (const siteContextDef of CONTEXTS.TENANT_SITE_LIST) {
        let site: Site = null;
        // Create site
        const siteTemplate = Factory.site.build({
          companyID: siteContextDef.companyID,
          userIDs: userListToAssign.map((user) => {
            return user.id;
          })
        });
        siteTemplate.name = siteContextDef.name;
        siteTemplate.allowAllUsersToStopTransactions = siteContextDef.allowAllUsersToStopTransactions;
        siteTemplate.autoUserSiteAssignment = siteContextDef.autoUserSiteAssignment;
        siteTemplate.id = siteContextDef.id;
        site = siteTemplate;
        site.id = await SiteStorage.saveSite(buildTenant.id, siteTemplate, true);
        await SiteStorage.addUsersToSite(buildTenant.id, site.id, userListToAssign.map((user) => {
          return user.id;
        }));
        const siteContext = new SiteContext(site, newTenantContext);
        newTenantContext.addSiteContext(siteContext);
        // Create site areas of current site
        for (const siteAreaDef of CONTEXTS.TENANT_SITEAREA_LIST.filter((siteArea) => {
          return siteArea.siteName === site.name;
        })) {
          const siteAreaTemplate = Factory.siteArea.build();
          siteAreaTemplate.id = siteAreaDef.id;
          siteAreaTemplate.name = siteAreaDef.name;
          siteAreaTemplate.accessControl = siteAreaDef.accessControl;
          siteAreaTemplate.siteID = site.id;
          console.log(siteAreaTemplate.name);
          const sireAreaID = await SiteAreaStorage.saveSiteArea(buildTenant.id, siteAreaTemplate);
          const siteAreaModel = await SiteAreaStorage.getSiteArea(buildTenant.id, sireAreaID);
          const siteAreaContext = new SiteAreaContext(siteAreaModel, newTenantContext);
          siteContext.addSiteArea(siteAreaContext);
          const relevantCS = CONTEXTS.TENANT_CHARGINGSTATION_LIST.filter((chargingStation) => {
            return chargingStation.siteAreaNames && chargingStation.siteAreaNames.includes(siteAreaModel.name) === true;
          });
          // Create Charging Station for site area
          for (const chargingStationDef of relevantCS) {
            const chargingStationTemplate = Factory.chargingStation.build();
            chargingStationTemplate.id = chargingStationDef.baseName + '-' + siteAreaModel.name;
            console.log(chargingStationTemplate.id);
            await newTenantContext.createChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, siteAreaModel);
          }
        }
      }
    }
    // Create unassigned Charging station
    const relevantCS = CONTEXTS.TENANT_CHARGINGSTATION_LIST.filter((chargingStation) => {
      return chargingStation.siteAreaNames === null;
    });
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
