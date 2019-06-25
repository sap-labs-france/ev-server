import CentralServerService from '../client/CentralServerService';
import Factory from '../../factories/Factory';
import TenantFactory from '../../factories/TenantFactory';
import UserFactory from '../../factories/UserFactory';
import CONTEXTS from './ContextConstants';
import User from '../../../src/entity/User';
import Company from '../../../src/types/Company';
import CompanyStorage from '../../../src/storage/mongodb/CompanyStorage';
import SiteAreaStorage from '../../../src/storage/mongodb/SiteAreaStorage';
import Site from '../../../src/entity/Site';
import Tenant from '../../../src/entity/Tenant';
import config from '../../config';
import MongoDBStorage from '../../../src/storage/mongodb/MongoDBStorage';
import TenantContext from './TenantContext';
import faker from 'faker';
import SiteContext from './SiteContext';
import SiteAreaContext from './SiteAreaContext';
import ChargingStationContext from './ChargingStationContext';
import Constants from '../../../src/utils/Constants';
// import * as mongo from 'mongodb';
import TSGlobal from '../../../src/types/GlobalType';
import moment from 'moment';

declare const global: TSGlobal;

export default class ContextBuilder {

  private superAdminCentralServerService: CentralServerService;
  private tenantsContexts: TenantContext[];
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
      for (const tenantContextDef of CONTEXTS.TENANT_CONTEXT_LIST) {
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
  async _buildTenantContext(tenantContextDef:any) {
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
    console.log('CREATE tenant context ' + buildTenant.id +
      ' ' + buildTenant.subdomain);
    // Retrieve default admin
    const existingUserList = (await User.getUsers(buildTenant.id)).result;
    let defaultAdminUser = null;
    // Search existing admin
    if (existingUserList && Array.isArray(existingUserList)) {
      defaultAdminUser = existingUserList.find((user) => {
        return user.getModel().id === CONTEXTS.TENANT_USER_LIST[0].id || user.getEMail() === config.get('admin.username') ||
          user.getRole() === 'A';
      });
    }
    if ((defaultAdminUser.getID() !== CONTEXTS.TENANT_USER_LIST[0].id) || (defaultAdminUser.getStatus() !== 'A')) {
      // It is a different default user so firt delete it
      await defaultAdminUser.delete();
      // Activate user
      defaultAdminUser.setStatus(CONTEXTS.TENANT_USER_LIST[0].status);
      // Generate the password hash
      const newPasswordHashed = await User.hashPasswordBcrypt(config.get('admin.password'));
      // Update the password
      defaultAdminUser.setPassword(newPasswordHashed);
      // Update the email
      defaultAdminUser.setEMail(config.get('admin.username'));
      // Add a Tag ID
      defaultAdminUser.setTagIDs(CONTEXTS.TENANT_USER_LIST[0].tagIDs ? CONTEXTS.TENANT_USER_LIST[0].tagIDs : [faker.random.alphaNumeric(8).toUpperCase()]);
      // Fix id
      defaultAdminUser.getModel().id = CONTEXTS.TENANT_USER_LIST[0].id;
      await defaultAdminUser.save();
    }

    // Create Central Server Service
    const localCentralServiceService: CentralServerService = new CentralServerService(buildTenant.subdomain);

    // Create Tenant component settings
    if (tenantContextDef.componentSettings) {
      console.log(`settings in tenant ${buildTenant.name} as ${JSON.stringify(tenantContextDef.componentSettings)}`);
      const allSettings:any = await localCentralServiceService.settingApi.readAll({}, {limit:0,skip:0});
      for (const setting in tenantContextDef.componentSettings) {
          let foundSetting:any = null;
          if (allSettings && allSettings.data && allSettings.data.result && allSettings.data.result.length > 0) {
            foundSetting = allSettings.data.result.find((existingSetting) => {
              return existingSetting.identifier === setting;
            });
          }
          if (!foundSetting) {
            // create new settings
            const settingInput = {
              identifier: setting,
              content: tenantContextDef.componentSettings[setting].content
            };
            console.log(`CREATE settings for ${setting} in tenant ${buildTenant.name}`);
            const response = await localCentralServiceService.createEntity(localCentralServiceService.settingApi,
              settingInput);
          }  else {
            console.log(`UPDATE settings for ${setting} in tenant ${buildTenant.name}`);
            foundSetting.content = tenantContextDef.componentSettings[setting].content;
            const response = await localCentralServiceService.updateEntity(localCentralServiceService.settingApi,
              foundSetting);
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
    // Skip first entry as it is the default admin already consider above
    for (let index = 1; index < CONTEXTS.TENANT_USER_LIST.length; index++) {
      const userDef = CONTEXTS.TENANT_USER_LIST[index];
      const createUser = UserFactory.build();
      createUser.email = userDef.emailPrefix + defaultAdminUser.getEMail();
      // Update the password
      const newPasswordHashed = await User.hashPasswordBcrypt(config.get('admin.password'));
      createUser.password = newPasswordHashed;
      createUser.role = userDef.role;
      createUser.status = userDef.status;
      createUser.id = userDef.id;
      if (userDef.tagIDs) {
        createUser.tagIDs = userDef.tagIDs;
      }
      const user = new User(buildTenant.id, createUser);
      user.save();
      if (userDef.assignedToSite) {
        userListToAssign.push(user.getModel());
      }
      // Set back password to clear value for login/logout
      const userModel = user.getModel();
      userModel.passwordClear = config.get('admin.password');
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
        const dummyCompany:any = Factory.company.build();
        dummyCompany.id = companyDef.id;
        dummyCompany.createdBy = { id : adminUser.id};
        dummyCompany.createdOn = moment().toISOString();
        company = await CompanyStorage.saveCompany(buildTenant.id, dummyCompany);
        newTenantContext.getContext().companies.push(dummyCompany);
      }
      // Build sites/sitearea according to tenant definition
      for (const siteContextDef of CONTEXTS.TENANT_SITE_LIST) {
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
        for (const siteAreaDef of CONTEXTS.TENANT_SITEAREA_LIST.filter(siteArea => siteArea.siteName === site.name)) {
          const siteAreaTemplate = Factory.siteArea.build();
          siteAreaTemplate.id = siteAreaDef.id;
          siteAreaTemplate.name = siteAreaDef.name;
          siteAreaTemplate.accessControl = siteAreaDef.accessControl;
          siteAreaTemplate.siteID = site.id;
          console.log(siteAreaTemplate.name);
          let sireAreaID = await SiteAreaStorage.saveSiteArea(buildTenant.id, siteAreaTemplate);
          let siteAreaModel = await SiteAreaStorage.getSiteArea(buildTenant.id, sireAreaID);
          const siteAreaContext = new SiteAreaContext(siteAreaModel, newTenantContext);
          siteContext.addSiteArea(siteAreaContext);
          const relevantCS = CONTEXTS.TENANT_CHARGINGSTATION_LIST.filter(chargingStation =>
            chargingStation.siteAreaNames && chargingStation.siteAreaNames.includes(siteAreaModel.name) === true);
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
    // create unassigned Charging station
    const relevantCS = CONTEXTS.TENANT_CHARGINGSTATION_LIST.filter(chargingStation =>
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
