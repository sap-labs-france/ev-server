import ContextDefinition, { TenantDefinition } from './ContextDefinition';
import { SettingDB, SettingDBContent } from '../../../src/types/Setting';

import AssetStorage from '../../../src/storage/mongodb/AssetStorage';
import BillingContext from './BillingContext';
import CentralServerService from '../client/CentralServerService';
import ChargingStation from '../../types/ChargingStation';
import CompanyStorage from '../../../src/storage/mongodb/CompanyStorage';
import Constants from '../../../src/utils/Constants';
import Factory from '../../factories/Factory';
import MongoDBStorage from '../../../src/storage/mongodb/MongoDBStorage';
import OCPIEndpoint from '../../../src/types/ocpi/OCPIEndpoint';
import OCPIEndpointStorage from '../../../src/storage/mongodb/OCPIEndpointStorage';
import { OCPIRegistrationStatus } from '../../../src/types/ocpi/OCPIRegistrationStatus';
import { OCPIRole } from '../../../src/types/ocpi/OCPIRole';
import OCPIUtils from '../../../src/server/ocpi/OCPIUtils';
import Site from '../../../src/types/Site';
import SiteAreaStorage from '../../../src/storage/mongodb/SiteAreaStorage';
import SiteContext from './SiteContext';
import SiteStorage from '../../../src/storage/mongodb/SiteStorage';
import StatisticsContext from './StatisticsContext';
import Tag from '../../types/Tag';
import TenantComponents from '../../../src/types/TenantComponents';
import TenantContext from './TenantContext';
import TenantFactory from '../../factories/TenantFactory';
import TenantStorage from '../../../src/storage/mongodb/TenantStorage';
import User from '../../../src/types/User';
import UserFactory from '../../factories/UserFactory';
import UserStorage from '../../../src/storage/mongodb/UserStorage';
import Utils from '../../../src/utils/Utils';
import config from '../../config';
import { expect } from 'chai';
import global from '../../../src/types/GlobalType';
import moment from 'moment';

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

  public static generateLocalToken(role: OCPIRole, tenantSubdomain: string): string {
    const newToken: any = {};
    newToken.ak = role;
    newToken.tid = tenantSubdomain;
    newToken.zk = role;
    return OCPIUtils.btoa(JSON.stringify(newToken));
  }

  async init(): Promise<void> {
    if (!this.initialized) {
      // Connect to the DB
      await global.database.start();
    }
    this.initialized = true;
  }

  async destroy(): Promise<void> {
    if (this.tenantsContexts && this.tenantsContexts.length > 0) {
      this.tenantsContexts.forEach(async (tenantContext) => {
        console.log(`Delete Tenant context '${tenantContext.getTenant().id} (${tenantContext.getTenant().subdomain})`);
        await this.superAdminCentralServerService.deleteEntity(this.superAdminCentralServerService.tenantApi, tenantContext.getTenant());
      });
    }
    // Delete all tenants
    for (const tenantContextDef of ContextDefinition.TENANT_CONTEXT_LIST) {
      let tenantEntity = await TenantStorage.getTenant(tenantContextDef.id);
      if (!tenantEntity) {
        tenantEntity = await TenantStorage.getTenantBySubdomain(tenantContextDef.subdomain);
      }
      if (tenantEntity) {
        console.log(`Delete Tenant '${tenantContextDef.id} (${tenantContextDef.subdomain})`);
        await this.superAdminCentralServerService.tenantApi.delete(tenantEntity.id);
      }
    }
  }

  async prepareContexts(): Promise<void> {
    await this.init();
    await this.destroy();
    // Build each tenant context
    for (const tenantContextDef of ContextDefinition.TENANT_CONTEXT_LIST) {
      await this.buildTenantContext(tenantContextDef);
    }
  }

  async buildTenantContext(tenantContextDef: TenantDefinition): Promise<TenantContext> {
    // Build component list
    const components = {};
    if (tenantContextDef.componentSettings) {
      for (const component in TenantComponents) {
        const componentName = TenantComponents[component];
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
    // Check if tenant exists
    TenantStorage.clearCache();
    const existingTenant = await TenantStorage.getTenant(tenantContextDef.id);
    if (existingTenant) {
      console.log(`Tenant ${tenantContextDef.id} already exist with name ${existingTenant.name}. Please run a destroy context`);
      throw new Error('Tenant id exist already');
    }
    let buildTenant: any = {};
    // Create Tenant
    const dummyTenant = TenantFactory.build();
    dummyTenant.name = tenantContextDef.tenantName;
    dummyTenant.subdomain = tenantContextDef.subdomain;
    dummyTenant.id = tenantContextDef.id;
    dummyTenant.components = components;
    buildTenant = await this.superAdminCentralServerService.createEntity(
      this.superAdminCentralServerService.tenantApi, dummyTenant);
    await this.superAdminCentralServerService.updateEntity(
      this.superAdminCentralServerService.tenantApi, buildTenant);
    console.log(`${buildTenant.id} (${buildTenant.name}) - Create tenant context`);
    const userId = await UserStorage.saveUser(buildTenant.id, {
      'id': ContextDefinition.TENANT_USER_LIST[0].id,
      'issuer': true,
      'name': 'Admin',
      'firstName': 'User',
      'email': config.get('admin.username'),
      'locale': 'en-US',
      'phone': '66666666666',
      'mobile': '66666666666',
      'plateID': '666-FB-69',
      'deleted': false
    });
    await UserStorage.saveUserStatus(buildTenant.id, userId, ContextDefinition.TENANT_USER_LIST[0].status);
    await UserStorage.saveUserRole(buildTenant.id, userId, ContextDefinition.TENANT_USER_LIST[0].role);
    await UserStorage.saveUserPassword(buildTenant.id, userId, { password: await Utils.hashPasswordBcrypt(config.get('admin.password')) });
    if (ContextDefinition.TENANT_USER_LIST[0].tags) {
      for (const tag of ContextDefinition.TENANT_USER_LIST[0].tags) {
        tag.userID = ContextDefinition.TENANT_USER_LIST[0].id;
        await UserStorage.saveTag(buildTenant.id, tag);
      }
    }
    const defaultAdminUser = await UserStorage.getUser(buildTenant.id, ContextDefinition.TENANT_USER_LIST[0].id);
    // Create Central Server Service
    const localCentralServiceService: CentralServerService = new CentralServerService(buildTenant.subdomain);
    // Create Tenant component settings
    if (tenantContextDef.componentSettings) {
      console.log(`Settings in tenant ${buildTenant.name} as ${JSON.stringify(tenantContextDef.componentSettings, null, ' ')}`);
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
            identifier: componentSettingKey as TenantComponents,
            content: tenantContextDef.componentSettings[componentSettingKey].content as SettingDBContent
          };
          console.log(`${buildTenant.id} (${buildTenant.name}) - Create settings for '${componentSettingKey}'`);
          await localCentralServiceService.createEntity(localCentralServiceService.settingApi, settingInput);
        } else {
          console.log(`${buildTenant.id} (${buildTenant.name}) - Update settings for '${componentSettingKey}'`);
          foundSetting.content = tenantContextDef.componentSettings[componentSettingKey].content;
          await localCentralServiceService.updateEntity(localCentralServiceService.settingApi, foundSetting);
        }
        if (componentSettingKey === TenantComponents.OCPI) {
          const cpoEndpoint = {
            name: 'CPO Endpoint',
            role: OCPIRole.CPO,
            countryCode: 'FR',
            partyId: 'CPO',
            baseUrl: 'https://ocpi-pp-iop.gireve.com/ocpi/emsp/versions',
            versionUrl: 'https://ocpi-pp-iop.gireve.com/emsp/cpo/2.1.1',
            version: '2.1.1',
            status: OCPIRegistrationStatus.REGISTERED,
            localToken: ContextBuilder.generateLocalToken(OCPIRole.CPO, tenantContextDef.subdomain),
            token: 'TOIOP-OCPI-TOKEN-cpo-xxxx-xxxx-yyyy'
          } as OCPIEndpoint;
          await OCPIEndpointStorage.saveOcpiEndpoint(buildTenant.id, cpoEndpoint);
          const emspEndpoint = {
            name: 'EMSP Endpoint',
            role: OCPIRole.EMSP,
            countryCode: 'FR',
            partyId: 'EMSP',
            baseUrl: 'https://ocpi-pp-iop.gireve.com/ocpi/cpo/versions',
            versionUrl: 'https://ocpi-pp-iop.gireve.com/ocpi/cpo/2.1.1',
            version: '2.1.1',
            status: OCPIRegistrationStatus.REGISTERED,
            localToken: ContextBuilder.generateLocalToken(OCPIRole.EMSP, tenantContextDef.subdomain),
            token: 'TOIOP-OCPI-TOKEN-emsp-xxxx-xxxx-yyyy'
          } as OCPIEndpoint;
          await OCPIEndpointStorage.saveOcpiEndpoint(buildTenant.id, emspEndpoint);
        }
      }
    }
    let userListToAssign: User[] = null;
    let userList: User[] = null;
    let tagList: Tag[] = null;
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
    for (let index = 1; index < ContextDefinition.TENANT_USER_LIST.length; index++) {
      const userDef = ContextDefinition.TENANT_USER_LIST[index];
      const createUser = UserFactory.build();
      createUser.email = userDef.emailPrefix + defaultAdminUser.email;
      createUser.issuer = true;
      // Update the password
      const newPasswordHashed = await Utils.hashPasswordBcrypt(config.get('admin.password'));
      createUser.id = userDef.id;
      const user: User = createUser;
      await UserStorage.saveUser(buildTenant.id, user);
      await UserStorage.saveUserStatus(buildTenant.id, user.id, userDef.status);
      await UserStorage.saveUserRole(buildTenant.id, user.id, userDef.role);
      await UserStorage.saveUserPassword(buildTenant.id, user.id, { password: newPasswordHashed });
      if (userDef.tags) {
        for (const tag of userDef.tags) {
          tag.userID = user.id;
          await UserStorage.saveTag(buildTenant.id, tag);
        }
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
    tagList = (await UserStorage.getTags(buildTenant.id, {}, Constants.DB_PARAMS_MAX_LIMIT)).result;
    newTenantContext.addTags(tagList);
    // Check if Organization is active
    if (buildTenant.components && Utils.objectHasProperty(buildTenant.components, TenantComponents.ORGANIZATION) &&
      buildTenant.components[TenantComponents.ORGANIZATION].active) {
      // Create the company
      for (const companyDef of ContextDefinition.TENANT_COMPANY_LIST) {
        const dummyCompany = Factory.company.build();
        dummyCompany.id = companyDef.id;
        dummyCompany.createdBy = { id: adminUser.id };
        dummyCompany.createdOn = moment().toISOString();
        dummyCompany.issuer = true;
        await CompanyStorage.saveCompany(buildTenant.id, dummyCompany);
        newTenantContext.getContext().companies.push(dummyCompany);
      }
      // Build sites/sitearea according to tenant definition
      for (const siteContextDef of ContextDefinition.TENANT_SITE_LIST) {
        let site: Site = null;
        // Create site
        const siteTemplate = Factory.site.build({
          companyID: siteContextDef.companyID,
          userIDs: userListToAssign.map((user) => user.id)
        });
        siteTemplate.name = siteContextDef.name;
        siteTemplate.autoUserSiteAssignment = siteContextDef.autoUserSiteAssignment;
        siteTemplate.public = siteContextDef.public;
        siteTemplate.id = siteContextDef.id;
        siteTemplate.issuer = true;
        site = siteTemplate;
        site.id = await SiteStorage.saveSite(buildTenant.id, siteTemplate, true);
        await SiteStorage.addUsersToSite(buildTenant.id, site.id, userListToAssign.map((user) => user.id));
        const siteContext = new SiteContext(site, newTenantContext);
        // Create site areas of current site
        for (const siteAreaDef of ContextDefinition.TENANT_SITEAREA_LIST.filter((siteArea) => siteArea.siteName === site.name)) {
          const siteAreaTemplate = Factory.siteArea.build();
          siteAreaTemplate.id = siteAreaDef.id;
          siteAreaTemplate.name = siteAreaDef.name;
          siteAreaTemplate.accessControl = siteAreaDef.accessControl;
          siteAreaTemplate.siteID = site.id;
          siteAreaTemplate.issuer = true;
          siteAreaTemplate.smartCharging = siteAreaDef.smartCharging;
          siteAreaTemplate.maximumPower = siteAreaDef.maximumPower;
          siteAreaTemplate.numberOfPhases = siteAreaDef.numberOfPhases;
          siteAreaTemplate.voltage = siteAreaDef.voltage;
          console.log(`${buildTenant.id} (${buildTenant.name}) - Site Area '${siteAreaTemplate.name}'`);
          const sireAreaID = await SiteAreaStorage.saveSiteArea(buildTenant.id, siteAreaTemplate);
          const siteAreaModel = await SiteAreaStorage.getSiteArea(buildTenant.id, sireAreaID);
          const siteAreaContext = siteContext.addSiteArea(siteAreaModel);
          const relevantCS = ContextDefinition.TENANT_CHARGING_STATION_LIST.filter(
            (chargingStation) => chargingStation.siteAreaNames && chargingStation.siteAreaNames.includes(siteAreaModel.name) === true);
          // Create Charging Station for site area
          for (const chargingStationDef of relevantCS) {
            let chargingStationTemplate: ChargingStation;
            if (siteAreaModel.numberOfPhases === 1) {
              chargingStationTemplate = Factory.chargingStation.buildChargingStationSinglePhased();
              chargingStationTemplate.id = chargingStationDef.baseName + '-' + siteAreaModel.name;
              console.log(`${buildTenant.id} (${buildTenant.name}) - Charging Station '${chargingStationTemplate.id}'`);
              const newChargingStationContext = await newTenantContext.createSinglePhasedChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, siteAreaModel);
              await siteAreaContext.addChargingStation(newChargingStationContext.getChargingStation());
            } else if (siteAreaModel.name === `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_DC}`) {
              chargingStationTemplate = Factory.chargingStation.buildChargingStationDC();
              chargingStationTemplate.id = chargingStationDef.baseName + '-' + siteAreaModel.name;
              console.log(`${buildTenant.id} (${buildTenant.name}) - Charging Station '${chargingStationTemplate.id}'`);
              const newChargingStationContext = await newTenantContext.createChargingStationDC(chargingStationDef.ocppVersion, chargingStationTemplate, null, siteAreaModel);
              await siteAreaContext.addChargingStation(newChargingStationContext.getChargingStation());
            } else if (siteAreaModel.name === `${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_SMART_CHARGING_THREE_PHASED}`) {
              chargingStationTemplate = Factory.chargingStation.build();
              chargingStationTemplate.id = chargingStationDef.baseName + '-' + siteAreaModel.name;
              console.log(`${buildTenant.id} (${buildTenant.name}) - Charging Station '${chargingStationTemplate.id}'`);
              let newChargingStationContext = await newTenantContext.createChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, siteAreaModel);
              await siteAreaContext.addChargingStation(newChargingStationContext.getChargingStation());
              chargingStationTemplate = Factory.chargingStation.buildChargingStationSinglePhased();
              chargingStationTemplate.id = chargingStationDef.baseName + '-' + siteAreaModel.name + '-' + 'singlePhased';
              console.log(`${buildTenant.id} (${buildTenant.name}) - Charging Station '${chargingStationTemplate.id}'`);
              newChargingStationContext = await newTenantContext.createSinglePhasedChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, siteAreaModel);
              await siteAreaContext.addChargingStation(newChargingStationContext.getChargingStation());
            } else {
              chargingStationTemplate = Factory.chargingStation.build();
              chargingStationTemplate.id = chargingStationDef.baseName + '-' + siteAreaModel.name;
              console.log(`${buildTenant.id} (${buildTenant.name}) - Charging Station '${chargingStationTemplate.id}'`);
              const newChargingStationContext = await newTenantContext.createChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, siteAreaModel);
              await siteAreaContext.addChargingStation(newChargingStationContext.getChargingStation());
            }
          }
        }
        newTenantContext.addSiteContext(siteContext);
      }
      // Check if the asset tenant exists and is activated
      if (Utils.objectHasProperty(buildTenant.components, TenantComponents.ASSET) &&
        buildTenant.components[TenantComponents.ASSET].active) {
        // Create Asset list
        for (const assetDef of ContextDefinition.TENANT_ASSET_LIST) {
          const dummyAsset = Factory.asset.build();
          dummyAsset.id = assetDef.id;
          dummyAsset.createdBy = { id: adminUser.id };
          dummyAsset.createdOn = moment().toISOString();
          dummyAsset.issuer = true;
          dummyAsset.siteAreaID = assetDef.siteAreaID;
          dummyAsset.assetType = 'CO';
          console.log(`${buildTenant.id} (${buildTenant.name}) - Asset '${dummyAsset.name}'`);
          await AssetStorage.saveAsset(buildTenant.id, dummyAsset);
          newTenantContext.getContext().assets.push(dummyAsset);
        }
      }
    }
    // Create unassigned Charging station
    const relevantCS = ContextDefinition.TENANT_CHARGING_STATION_LIST.filter((chargingStation) => chargingStation.siteAreaNames === null);
    // Create Charging Station for site area
    const siteContext = new SiteContext({
      id: 1,
      name: ContextDefinition.SITE_CONTEXTS.NO_SITE
    }, newTenantContext);
    const emptySiteAreaContext = siteContext.addSiteArea({
      id: 1,
      name: ContextDefinition.SITE_AREA_CONTEXTS.NO_SITE
    });
    for (const chargingStationDef of relevantCS) {
      const chargingStationTemplate = Factory.chargingStation.build();
      chargingStationTemplate.id = chargingStationDef.baseName;
      console.log(`${buildTenant.id} (${buildTenant.name}) - Charging Station '${chargingStationTemplate.id}'`);
      const newChargingStationContext = await newTenantContext.createChargingStation(chargingStationDef.ocppVersion, chargingStationTemplate, null, null);
      await emptySiteAreaContext.addChargingStation(newChargingStationContext.getChargingStation());
    }
    newTenantContext.addSiteContext(siteContext);
    // Create transaction/session data for a specific tenants:
    const statisticContext = new StatisticsContext(newTenantContext);
    const billingContext = new BillingContext(newTenantContext);
    switch (tenantContextDef.tenantName) {
      case ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS:
        console.log(`${buildTenant.id} (${buildTenant.name}) - Transactions - Site Area '${ContextDefinition.SITE_CONTEXTS.SITE_BASIC}-${ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL}'`);
        await statisticContext.createTestData(ContextDefinition.SITE_CONTEXTS.SITE_BASIC, ContextDefinition.SITE_AREA_CONTEXTS.WITH_ACL);
        break;
      case ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS:
        console.log(`${buildTenant.id} (${buildTenant.name}) - Transactions - Unassigned Charging Stations`);
        await statisticContext.createTestData(ContextDefinition.SITE_CONTEXTS.NO_SITE, ContextDefinition.SITE_AREA_CONTEXTS.NO_SITE);
        break;
      case ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING:
        console.log(`${buildTenant.id} (${buildTenant.name}) - Invoices`);
        await billingContext.createTestData();
    }
    return newTenantContext;
  }
}
