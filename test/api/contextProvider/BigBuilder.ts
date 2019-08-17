import config from '../../config';
import faker from 'faker';
import moment from 'moment';
import { ObjectID } from 'mongodb';
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
import TenantContext from './TenantContext';
import TenantFactory from '../../factories/TenantFactory';
import User from '../../../src/types/User';
import UserFactory from '../../factories/UserFactory';
import UserStorage from '../../../src/storage/mongodb/UserStorage';
import TenantStorage from '../../../src/storage/mongodb/TenantStorage';
import Utils from '../../../src/utils/Utils';

const NBR_USERS = 10; // Number of total users : they are all connected to the sites
const NBR_COMPANIES = 5; // Number of companies
const NBR_SITES = 5; // Number of sites PER company
const NBR_SITEAREAS = 5; // Number of site areas per site
const NBR_CHARGINGSTATIONS = 5; // Number of charging stations per site area
const BIG_CONTEXT = [{
  tenantName: 'Big',
  id: 'b1b1b1b1b1b1b1b1b1b1b1b1',
  subdomain: 'big',
  componentSettings: {
    pricing: {
      type: 'simple',
      content: {
        simple: {
          price: 1,
          currency: 'EUR'
        }
      },
    },
    ocpi: {
      type: 'gireve',
      content: {
        countryCode: 'FR',
        partyId: 'UT',
        businessDetails: {
          name: 'Test OCPI',
          website: 'http://www.uttest.net'
        }
      }
    },
    organization: {},
  },
}];

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
      return setTimeout(() => { // Delay deletion as unit tests are faster than processing
        this.tenantsContexts.forEach(async (tenantContext) => {
          // pragma console.log('DESTROY context ' + tenantContext.getTenant().id + ' ' + tenantContext.getTenant().subdomain);
          await this.superAdminCentralServerService.deleteEntity(this.superAdminCentralServerService.tenantApi, tenantContext.getTenant());
        });
      }, 10000);
    }
    // Delete all tenants
    for (const tenantContextDef of BIG_CONTEXT) {
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
    const tenantContexts = BIG_CONTEXT;
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
    // Retrieve default admin
    const existingUserList = (await UserStorage.getUsers(buildTenant.id, {}, Constants.DB_PARAMS_MAX_LIMIT)).result;
    let defaultAdminUser: User = null;
    // Search existing admin
    if (existingUserList && Array.isArray(existingUserList)) {
      defaultAdminUser = existingUserList.find((user) => {
        return user.id === CONTEXTS.TENANT_USER_LIST[0].id || user.email === config.get('admin.username') ||
          user.role === 'A';
      });
    }
    if ((defaultAdminUser.id !== CONTEXTS.TENANT_USER_LIST[0].id) || (defaultAdminUser.status !== 'A')) {
      // It is a different default user so first delete it
      await UserStorage.deleteUser(buildTenant.id, defaultAdminUser.id);
      // Generate the password hash
      const newPasswordHashed = await Utils.hashPasswordBcrypt(config.get('admin.password'));
      // Update the email
      defaultAdminUser.email = config.get('admin.username');
      // Add a Tag ID
      defaultAdminUser.tagIDs = CONTEXTS.TENANT_USER_LIST[0].tagIDs ? CONTEXTS.TENANT_USER_LIST[0].tagIDs : [faker.random.alphaNumeric(8).toUpperCase()];
      // Fix id
      defaultAdminUser.id = CONTEXTS.TENANT_USER_LIST[0].id;
      const userId = await UserStorage.saveUser(buildTenant.id, defaultAdminUser);
      await UserStorage.saveUserStatus(buildTenant.id, userId, CONTEXTS.TENANT_USER_LIST[0].status);
      await UserStorage.saveUserRole(buildTenant.id, userId, CONTEXTS.TENANT_USER_LIST[0].role);
      await UserStorage.saveUserPassword(buildTenant.id, userId, { password: newPasswordHashed });
    }

    // Create Central Server Service
    const localCentralServiceService: CentralServerService = new CentralServerService(buildTenant.subdomain);

    // Create Tenant component settings
    if (tenantContextDef.componentSettings) {
      console.log(`settings in tenant ${buildTenant.name} as ${JSON.stringify(tenantContextDef.componentSettings)}`);
      const allSettings: any = await localCentralServiceService.settingApi.readAll({}, Constants.DB_PARAMS_MAX_LIMIT);
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
          await localCentralServiceService.createEntity(localCentralServiceService.settingApi,
            settingInput);
        } else {
          console.log(`UPDATE settings for ${setting} in tenant ${buildTenant.name}`);
          foundSetting.content = tenantContextDef.componentSettings[setting].content;
          await localCentralServiceService.updateEntity(localCentralServiceService.settingApi,
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
    for (let index = 1; index <= NBR_USERS; index++) {
      const userDef = {
        id: '',
        role: CONTEXTS.USER_CONTEXTS.BASIC_USER.role,
        status: CONTEXTS.USER_CONTEXTS.BASIC_USER.status,
        assignedToSite: CONTEXTS.USER_CONTEXTS.BASIC_USER.assignedToSite,
        emailPrefix: 'basic-',
        tagIDs: []
      };
      userDef.id = new ObjectID().toHexString();
      const createUser: User = UserFactory.build();
      userDef.tagIDs.push(`A1234${index}`);
      // Update the password
      const newPasswordHashed = await Utils.hashPasswordBcrypt(config.get('admin.password'));
      createUser.id = userDef.id;
      if (userDef.tagIDs) {
        createUser.tagIDs = userDef.tagIDs;
      }
      const user: User = createUser;
      await UserStorage.saveUser(buildTenant.id, user, false);
      await UserStorage.saveUserPassword(buildTenant.id, user.id, { password: newPasswordHashed });
      await UserStorage.saveUserStatus(buildTenant.id, user.id, userDef.status);
      await UserStorage.saveUserRole(buildTenant.id, user.id, userDef.role);
      if (userDef.assignedToSite) {
        userListToAssign.push(user);
      }
      // Set back password to clear value for login/logout
      const userModel = user;
      (userModel as any).passwordClear = config.get('admin.password');
      userList.push(userModel);
    }
    const registrationTokenResponse = await localCentralServiceService.registrationApi.create();
    // Persist tenant context
    const newTenantContext = new TenantContext(tenantContextDef.tenantName, buildTenant, registrationTokenResponse.data.id, localCentralServiceService, null);
    this.tenantsContexts.push(newTenantContext);
    newTenantContext.addUsers(userList);
    // Check if Organization is active
    if (buildTenant.components && buildTenant.components.hasOwnProperty(Constants.COMPONENTS.ORGANIZATION) &&
      buildTenant.components[Constants.COMPONENTS.ORGANIZATION].active) {
      // Create the company
      for (let counterComp = 1; counterComp <= NBR_COMPANIES; counterComp++) {
        let company = null;
        const companyDef = {
          id: new ObjectID().toHexString()
        };
        const dummyCompany: any = Factory.company.build();
        dummyCompany.id = companyDef.id;
        dummyCompany.createdBy = { id: adminUser.id };
        dummyCompany.createdOn = moment().toISOString();
        company = await CompanyStorage.saveCompany(buildTenant.id, dummyCompany);
        newTenantContext.getContext().companies.push(dummyCompany);
        console.log(`Create company : ${dummyCompany.id}`);
        // Build sites/sitearea according to tenant definition
        for (let counterSite = 1; counterSite <= NBR_SITES; counterSite++) {
          const siteContextDef = {
            id: new ObjectID().toHexString(),
            name: CONTEXTS.SITE_CONTEXTS.SITE_BASIC,
            autoUserSiteAssignment: false,
            companyID: companyDef.id
          };
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
          console.log(`* Create site : ${siteTemplate.id}`);
          await SiteStorage.addUsersToSite(buildTenant.id, site.id, userListToAssign.map((user) => {
            return user.id;
          }));
          const siteContext = new SiteContext(site, newTenantContext);
          newTenantContext.addSiteContext(siteContext);
          // Create site areas of current site
          for (let counterSiteA = 1; counterSiteA <= NBR_SITEAREAS; counterSiteA++) {
            const siteAreaDef = {
              id: new ObjectID().toHexString(),
              name: `${CONTEXTS.SITE_CONTEXTS.SITE_BASIC}-${CONTEXTS.SITE_AREA_CONTEXTS.WITHOUT_ACL}`,
              accessControl: false,
              siteName: siteTemplate.name
            };
            const siteAreaTemplate = Factory.siteArea.build();
            siteAreaTemplate.id = siteAreaDef.id;
            // pragma siteAreaTemplate.name = siteAreaDef.name;
            siteAreaTemplate.accessControl = siteAreaDef.accessControl;
            siteAreaTemplate.siteID = site.id;
            const sireAreaID = await SiteAreaStorage.saveSiteArea(buildTenant.id, siteAreaTemplate);
            console.log(`** Create sitearea : ${siteAreaTemplate.id}`);
            const siteAreaModel = await SiteAreaStorage.getSiteArea(buildTenant.id, sireAreaID);
            const siteAreaContext = new SiteAreaContext(siteAreaModel, newTenantContext);
            siteContext.addSiteArea(siteAreaContext);
            // Create Charging Station for site area
            for (let counterCS = 1; counterCS <= NBR_CHARGINGSTATIONS; counterCS++) {
              const chargingStationDef = {
                baseName: new ObjectID().toHexString(),
                ocppVersion: '1.6',
                siteAreaNames: [siteAreaTemplate.id]
              };
              const chargingStationTemplate = Factory.chargingStation.build();
              chargingStationTemplate.id = chargingStationDef.baseName;
              console.log(`*** Create charging station : ${chargingStationTemplate.id}`);
              await newTenantContext.createChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, siteAreaModel);
            }
          }
        }
      }
    }
    return newTenantContext;
  }
}
