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
import SiteAreaStorage from '../../../src/storage/mongodb/SiteAreaStorage';
import SiteContext from './SiteContext';
import SiteStorage from '../../../src/storage/mongodb/SiteStorage';
import StatisticsContext from './StatisticsContext';
import Tenant from '../../../src/types/Tenant';
import TenantContext from './TenantContext';
import TenantFactory from '../../factories/TenantFactory';
import User from '../../../src/types/User';
import UserFactory from '../../factories/UserFactory';
import UserStorage from '../../../src/storage/mongodb/UserStorage';
import Utils from '../../../src/utils/Utils';
import { expect } from 'chai';
import TenantStorage from '../../../src/storage/mongodb/TenantStorage';

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

  async _init() {
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
    console.log('CREATE tenant context ' + buildTenant.id +
      ' ' + buildTenant.subdomain);

    const userId = await UserStorage.saveUser(buildTenant.id, {
      'id': CONTEXTS.TENANT_USER_LIST[0].id,
      'email': config.get('admin.username'),
      'locale': 'en-US',
      'phone': faker.phone.phoneNumber(),
      'mobile': faker.phone.phoneNumber(),
      'plateID': faker.random.alphaNumeric(8),
      'deleted': false
    });
    await UserStorage.saveUserStatus(buildTenant.id, userId, CONTEXTS.TENANT_USER_LIST[0].status);
    await UserStorage.saveUserRole(buildTenant.id, userId, CONTEXTS.TENANT_USER_LIST[0].role);
    await UserStorage.saveUserPassword(buildTenant.id, userId, { password: await Utils.hashPasswordBcrypt(config.get('admin.password')) });
    if (CONTEXTS.TENANT_USER_LIST[0].tagIDs) {
      await UserStorage.saveUserTags(buildTenant.id, CONTEXTS.TENANT_USER_LIST[0].id, CONTEXTS.TENANT_USER_LIST[0].tagIDs);
    }
    const defaultAdminUser = await UserStorage.getUser(buildTenant.id, CONTEXTS.TENANT_USER_LIST[0].id);

    // Create Central Server Service
    const localCentralServiceService: CentralServerService = new CentralServerService(buildTenant.subdomain);

    // Create Tenant component settings
    if (tenantContextDef.componentSettings) {
      console.log(`settings in tenant ${buildTenant.name} as ${JSON.stringify(tenantContextDef.componentSettings)}`);
      const allSettings: any = await localCentralServiceService.settingApi.readAll({}, Constants.DB_PARAMS_MAX_LIMIT);
      expect(allSettings.status).to.equal(200);
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
      if (userDef.tagIDs) {
        await UserStorage.saveUserTags(buildTenant.id, userDef.id, userDef.tagIDs);
      }
      if (userDef.assignedToSite) {
        userListToAssign.push(user);
      }
      // Set back password to clear value for login/logout
      const userModel = user;
      (userModel as any).passwordClear = config.get('admin.password'); // TODO ?
      userList.push(userModel);
    }
    // Persist tenant context
    const newTenantContext = new TenantContext(tenantContextDef.tenantName, buildTenant, '', localCentralServiceService, null);
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
        dummyCompany.createdBy = { id: adminUser.id };
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
        siteTemplate.autoUserSiteAssignment = siteContextDef.autoUserSiteAssignment;
        siteTemplate.id = siteContextDef.id;
        site = siteTemplate;
        site.id = await SiteStorage.saveSite(buildTenant.id, siteTemplate, true);
        await SiteStorage.addUsersToSite(buildTenant.id, site.id, userListToAssign.map((user) => {
          return user.id;
        }));
        const siteContext = new SiteContext(site, newTenantContext);
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
          const siteAreaContext = siteContext.addSiteArea(siteAreaModel);
          const relevantCS = CONTEXTS.TENANT_CHARGINGSTATION_LIST.filter((chargingStation) => {
            return chargingStation.siteAreaNames && chargingStation.siteAreaNames.includes(siteAreaModel.name) === true;
          });
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
    const relevantCS = CONTEXTS.TENANT_CHARGINGSTATION_LIST.filter((chargingStation) => {
      return chargingStation.siteAreaNames === null;
    });
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
