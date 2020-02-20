import { expect } from 'chai';
import moment from 'moment';
import CompanyStorage from '../../../src/storage/mongodb/CompanyStorage';
import MongoDBStorage from '../../../src/storage/mongodb/MongoDBStorage';
import SiteAreaStorage from '../../../src/storage/mongodb/SiteAreaStorage';
import SiteStorage from '../../../src/storage/mongodb/SiteStorage';
import TenantStorage from '../../../src/storage/mongodb/TenantStorage';
import UserStorage from '../../../src/storage/mongodb/UserStorage';
import global from '../../../src/types/GlobalType';
import { ComponentType, SettingDB, SettingDBContent } from '../../../src/types/Setting';
import Site from '../../../src/types/Site';
import User from '../../../src/types/User';
import Constants from '../../../src/utils/Constants';
import Utils from '../../../src/utils/Utils';
import config from '../../config';
import Factory from '../../factories/Factory';
import TenantFactory from '../../factories/TenantFactory';
import UserFactory from '../../factories/UserFactory';
import CentralServerService from '../client/CentralServerService';
import CONTEXTS from './ContextConstants';
import SiteContext from './SiteContext';
import StatisticsContext from './StatisticsContext';
import TenantContext from './TenantContext';

export default class ContextBuilder {

  private superAdminCentralServerService: CentralServerService;
  private tenantsContexts: TenantContext[];
  private initialized: boolean;

  constructor() {
    // Create a super admin interface
    this.superAdminCentralServerService = new CentralServerService(null, {
      email: config.get('superadmin.username'),
      password: config.get('superadmin.password')
    });
    this.tenantsContexts = [];
    // Create MongoDB
    global.database = new MongoDBStorage(config.get('storage'));
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      // Connect to the the DB
      await global.database.start();
    }
    this.initialized = true;
  }

  async destroy() {
    if (this.tenantsContexts && this.tenantsContexts.length > 0) {
      this.tenantsContexts.forEach(async (tenantContext) => {
        console.log('Delete tenant context ' + tenantContext.getTenant().id + ' ' + tenantContext.getTenant().subdomain);
        await this.superAdminCentralServerService.deleteEntity(this.superAdminCentralServerService.tenantApi, tenantContext.getTenant());
      });
    }
    // Delete all tenants
    for (const tenantContextDef of CONTEXTS.TENANT_CONTEXT_LIST) {
      console.log('Delete tenant ' + tenantContextDef.id + ' ' + tenantContextDef.subdomain);
      const tenantEntity = await TenantStorage.getTenantByName(tenantContextDef.tenantName);
      if (tenantEntity) {
        await this.superAdminCentralServerService.tenantApi.delete(tenantEntity.id);
      }
    }
  }

  async prepareContexts() {
    await this.init();
    await this.destroy();
    // Prepare list of tenants to create
    const tenantContexts = CONTEXTS.TENANT_CONTEXT_LIST;
    // Build each tenant context
    for (const tenantContextDef of tenantContexts) {
      await this.buildTenantContext(tenantContextDef);
    }
  }

  async buildTenantContext(tenantContextDef: any) {
    // Build component list
    const components = {};
    if (tenantContextDef.componentSettings) {
      for (const component in Constants.COMPONENTS) {
        const componentName = Constants.COMPONENTS[component];
        if (Utils.objectHasProperty(tenantContextDef.componentSettings, componentName)) {
          components[componentName] = {
            active: true
          };
          if (Utils.objectHasProperty(tenantContextDef.componentSettings[componentName], 'type')) {
            components[componentName]['type'] = tenantContextDef.componentSettings[componentName].type;
          }
        }
      }
    }
    // Check if tenant exist
    const existingTenant = await TenantStorage.getTenant(tenantContextDef.id);
    if (existingTenant) {
      console.log(`Tenant ${tenantContextDef.id} already exist with name ${existingTenant.name}. Please run a destroy context`);
      throw new Error('Tenant id exist already');

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
    console.log('CREATE tenant context ' + buildTenant.id + ' ' + buildTenant.subdomain);
    const userId = await UserStorage.saveUser(buildTenant.id, {
      'id': CONTEXTS.TENANT_USER_LIST[0].id,
      'name': 'Admin',
      'firstName': 'User',
      'email': config.get('admin.username'),
      'locale': 'en-US',
      'phone': '66666666666',
      'mobile': '66666666666',
      'plateID': '666-FB-69',
      'deleted': false
    });
    await UserStorage.saveUserStatus(buildTenant.id, userId, CONTEXTS.TENANT_USER_LIST[0].status);
    await UserStorage.saveUserRole(buildTenant.id, userId, CONTEXTS.TENANT_USER_LIST[0].role);
    await UserStorage.saveUserPassword(buildTenant.id, userId, { password: await Utils.hashPasswordBcrypt(config.get('admin.password')) });
    if (CONTEXTS.TENANT_USER_LIST[0].tags) {
      await UserStorage.saveUserTags(buildTenant.id, CONTEXTS.TENANT_USER_LIST[0].id, CONTEXTS.TENANT_USER_LIST[0].tags);
    }
    const defaultAdminUser = await UserStorage.getUser(buildTenant.id, CONTEXTS.TENANT_USER_LIST[0].id);
    // Create Central Server Service
    const localCentralServiceService: CentralServerService = new CentralServerService(buildTenant.subdomain);
    // Create Tenant component settings
    if (tenantContextDef.componentSettings) {
      console.log(`settings in tenant ${buildTenant.name} as ${JSON.stringify(tenantContextDef.componentSettings)}`);
      const allSettings: any = await localCentralServiceService.settingApi.readAll({}, Constants.DB_PARAMS_MAX_LIMIT);
      expect(allSettings.status).to.equal(200);
      for (const componentSettingKey in tenantContextDef.componentSettings) {
        let foundSetting: any = null;
        if (allSettings && allSettings.data && allSettings.data.result && allSettings.data.result.length > 0) {
          foundSetting = allSettings.data.result.find((existingSetting) => existingSetting.identifier === componentSettingKey);
        }
        if (!foundSetting) {
          // Create new settings
          const settingInput: SettingDB = {
            identifier: componentSettingKey as ComponentType,
            content: tenantContextDef.componentSettings[componentSettingKey].content as SettingDBContent
          };
          console.log(`CREATE settings for ${componentSettingKey} in tenant ${buildTenant.name}`);
          await localCentralServiceService.createEntity(localCentralServiceService.settingApi, settingInput);
        } else {
          console.log(`UPDATE settings for ${componentSettingKey} in tenant ${buildTenant.name}`);
          foundSetting.content = tenantContextDef.componentSettings[componentSettingKey].content;
          await localCentralServiceService.updateEntity(localCentralServiceService.settingApi, foundSetting);
        }
      }
    }
    let userListToAssign: User[] = null;
    let userList: User[] = null;
    // Read admin user
    const adminUser: User = (await localCentralServiceService.getEntityById(
      localCentralServiceService.userApi, defaultAdminUser, false)).data;
    if (!adminUser.id) {
      console.log('Error with new Admin user: ', adminUser);
    }
    userListToAssign = [adminUser]; // Default admin is always assigned to site
    userList = [adminUser]; // Default admin is always assigned to site
    // Prepare users
    // Skip first entry as it is the default admin already consider above
    for (let index = 1; index < CONTEXTS.TENANT_USER_LIST.length; index++) {
      const userDef = CONTEXTS.TENANT_USER_LIST[index];
      const createUser = UserFactory.build();
      createUser.email = userDef.emailPrefix + defaultAdminUser.email;
      // Update the password
      const newPasswordHashed = await Utils.hashPasswordBcrypt(config.get('admin.password'));
      createUser.id = userDef.id;
      const user: User = createUser;
      await UserStorage.saveUser(buildTenant.id, user);
      await UserStorage.saveUserStatus(buildTenant.id, user.id, userDef.status);
      await UserStorage.saveUserRole(buildTenant.id, user.id, userDef.role);
      await UserStorage.saveUserPassword(buildTenant.id, user.id, { password: newPasswordHashed });
      if (userDef.tags) {
        await UserStorage.saveUserTags(buildTenant.id, user.id, userDef.tags);
      }
      const userModel = await UserStorage.getUser(buildTenant.id, user.id);
      if (userDef.assignedToSite) {
        userListToAssign.push(userModel);
      }
      // Set back password to clear value for login/logout
      (userModel as any).passwordClear = config.get('admin.password');
      userList.push(userModel);
    }
    // Persist tenant context
    const newTenantContext = new TenantContext(tenantContextDef.tenantName, buildTenant, '', localCentralServiceService, null);
    this.tenantsContexts.push(newTenantContext);
    newTenantContext.addUsers(userList);
    // Check if Organization is active
    if (buildTenant.components && Utils.objectHasProperty(buildTenant.components, Constants.COMPONENTS.ORGANIZATION) &&
      buildTenant.components[Constants.COMPONENTS.ORGANIZATION].active) {
      // Create the company
      for (const companyDef of CONTEXTS.TENANT_COMPANY_LIST) {
        const dummyCompany: any = Factory.company.build();
        dummyCompany.id = companyDef.id;
        dummyCompany.createdBy = { id: adminUser.id };
        dummyCompany.createdOn = moment().toISOString();
        await CompanyStorage.saveCompany(buildTenant.id, dummyCompany);
        newTenantContext.getContext().companies.push(dummyCompany);
      }
      // Build sites/sitearea according to tenant definition
      for (const siteContextDef of CONTEXTS.TENANT_SITE_LIST) {
        let site: Site = null;
        // Create site
        const siteTemplate = Factory.site.build({
          companyID: siteContextDef.companyID,
          userIDs: userListToAssign.map((user) => user.id)
        });
        siteTemplate.name = siteContextDef.name;
        siteTemplate.autoUserSiteAssignment = siteContextDef.autoUserSiteAssignment;
        siteTemplate.id = siteContextDef.id;
        site = siteTemplate;
        site.id = await SiteStorage.saveSite(buildTenant.id, siteTemplate, true);
        await SiteStorage.addUsersToSite(buildTenant.id, site.id, userListToAssign.map((user) => user.id));
        const siteContext = new SiteContext(site, newTenantContext);
        // Create site areas of current site
        for (const siteAreaDef of CONTEXTS.TENANT_SITEAREA_LIST.filter((siteArea) => siteArea.siteName === site.name)) {
          const siteAreaTemplate = Factory.siteArea.build();
          siteAreaTemplate.id = siteAreaDef.id;
          siteAreaTemplate.name = siteAreaDef.name;
          siteAreaTemplate.accessControl = siteAreaDef.accessControl;
          siteAreaTemplate.siteID = site.id;
          console.log(siteAreaTemplate.name);
          const sireAreaID = await SiteAreaStorage.saveSiteArea(buildTenant.id, siteAreaTemplate);
          const siteAreaModel = await SiteAreaStorage.getSiteArea(buildTenant.id, sireAreaID);
          const siteAreaContext = siteContext.addSiteArea(siteAreaModel);
          const relevantCS = CONTEXTS.TENANT_CHARGING_STATION_LIST.filter(
            (chargingStation) => chargingStation.siteAreaNames && chargingStation.siteAreaNames.includes(siteAreaModel.name) === true);
          // Create Charging Station for site area
          for (const chargingStationDef of relevantCS) {
            const chargingStationTemplate = Factory.chargingStation.build();
            chargingStationTemplate.id = chargingStationDef.baseName + '-' + siteAreaModel.name;
            console.log(chargingStationTemplate.id);
            const newChargingStationContext = await newTenantContext.createChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, siteAreaModel);
            await siteAreaContext.addChargingStation(newChargingStationContext.getChargingStation());
          }
        }
        newTenantContext.addSiteContext(siteContext);
      }
    }
    // Create unassigned Charging station
    const relevantCS = CONTEXTS.TENANT_CHARGING_STATION_LIST.filter((chargingStation) => chargingStation.siteAreaNames === null);
    // Create Charging Station for site area
    const siteContext = new SiteContext({
      id: 1,
      name: CONTEXTS.SITE_CONTEXTS.NO_SITE
    }, newTenantContext);
    const emptySiteAreaContext = siteContext.addSiteArea({
      id: 1,
      name: CONTEXTS.SITE_AREA_CONTEXTS.NO_SITE
    });
    for (const chargingStationDef of relevantCS) {
      const chargingStationTemplate = Factory.chargingStation.build();
      chargingStationTemplate.id = chargingStationDef.baseName;
      console.log(chargingStationTemplate.id);
      const newChargingStationContext = await newTenantContext.createChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, null);
      await emptySiteAreaContext.addChargingStation(newChargingStationContext.getChargingStation());
    }
    newTenantContext.addSiteContext(siteContext);
    // Create transaction/session data for a specific tenants:
    const statisticContext = new StatisticsContext(newTenantContext);
    switch (tenantContextDef.tenantName) {
      case CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS:
        console.log(`Create transactions for chargers of site area ${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL}`);
        await statisticContext.createTestData(CONTEXTS.SITE_CONTEXTS.SITE_BASIC, CONTEXTS.SITE_AREA_CONTEXTS.WITH_ACL);
        break;
      case CONTEXTS.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS:
        console.log('Create transactions for unassigned chargers');
        await statisticContext.createTestData(CONTEXTS.SITE_CONTEXTS.NO_SITE, CONTEXTS.SITE_AREA_CONTEXTS.NO_SITE);
        break;
    }
    return newTenantContext;
  }
}
