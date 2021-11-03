import chai, { expect } from 'chai';

import CentralServerService from '../client/CentralServerService';
import ContextDefinition from './ContextDefinition';
import Factory from '../../factories/Factory';
import { OCPPVersion } from '../../../src/types/ocpp/OCPPServer';
import { ObjectId } from 'mongodb';
import SiteContext from './SiteContext';
import { TenantComponents } from '../../../src/types/Tenant';
import TenantContext from './TenantContext';
import TestConstants from '../client/utils/TestConstants';
import chaiSubset from 'chai-subset';
import config from '../../config';

chai.use(chaiSubset);

export default class ContextProvider {

  private static _defaultInstance = new ContextProvider();

  private superAdminCentralServerService: CentralServerService;
  private tenantsContexts: TenantContext[];
  private initialized: boolean;
  private tenantEntities: any;

  constructor() {
    // Create a super admin interface
    this.superAdminCentralServerService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    this.tenantsContexts = [];
    this.initialized = false;
  }

  public static get defaultInstance(): ContextProvider {
    if (!ContextProvider._defaultInstance) {
      ContextProvider._defaultInstance = new ContextProvider();
    }
    return ContextProvider._defaultInstance;
  }

  async _init(): Promise<void> {
    if (!this.initialized) {
      // Read all tenants
      this.tenantEntities = (await this.superAdminCentralServerService.tenantApi.readAll({ WithComponents: true }, TestConstants.DEFAULT_PAGING)).data.result;
    }
    this.initialized = true;
  }

  async prepareContexts(tenantContextNames?: string[]): Promise<void> {
    try {
      await this._init();
      // Prepare list of tenants to create
      let tenantContexts = ContextDefinition.TENANT_CONTEXT_LIST;
      if (tenantContextNames) {
        if (!Array.isArray(tenantContextNames)) {
          tenantContextNames = [tenantContextNames];
        }
        tenantContexts = tenantContextNames.map((tenantName) => ContextDefinition.TENANT_CONTEXT_LIST.find((tenantContext) => {
          tenantContext.tenantName === tenantName;
        }));
      }
      // Build each tenant context
      for (const tenantContextDef of tenantContexts) {
        await this._tenantEntityContext(tenantContextDef);
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getTenantContext(tenantContextName): Promise<TenantContext> {
    await this._init();
    const tenantContext = this._getTenantContext(tenantContextName);
    // Check if already loaded
    if (tenantContext) {
      return tenantContext;
    }
    // Not find build context
    return this._tenantEntityContext(this._getTenantContextDef(tenantContextName));
  }

  async _tenantEntityContext(tenantContextDef): Promise<TenantContext> {
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
    let tagList = null;
    // Read all existing entities
    if (tenantEntity.components && tenantEntity.components[TenantComponents.ORGANIZATION] &&
      tenantEntity.components[TenantComponents.ORGANIZATION].active) {
      siteAreaList = (await defaultAdminCentralServiceService.siteAreaApi.readAll({}, { limit: 0, skip: 0 })).data.result;
      siteList = (await defaultAdminCentralServiceService.siteApi.readAll({}, { limit: 0, skip: 0 })).data.result;
      companyList = (await defaultAdminCentralServiceService.companyApi.readAll({}, { limit: 0, skip: 0 })).data.result;
      chargingStationList = (await defaultAdminCentralServiceService.chargingStationApi.readAll({}, TestConstants.DEFAULT_PAGING)).data.result;
    } else {
      chargingStationList = (await defaultAdminCentralServiceService.chargingStationApi.readAll({ WithNoSiteArea: true }, TestConstants.DEFAULT_PAGING)).data.result;
    }
    userList = (await defaultAdminCentralServiceService.userApi.readAll({}, { limit: 0, skip: 0 })).data.result;
    tagList = (await defaultAdminCentralServiceService.tagApi.readTags({}, { limit: 0, skip: 0 })).data.result;
    for (const user of userList) {
      user.password = config.get('admin.password');
      user.centralServerService = new CentralServerService(tenantEntity.subdomain, user);
    }

    // Create tenant context
    const newTenantContext = new TenantContext(tenantContextDef.tenantName, tenantEntity, '', defaultAdminCentralServiceService, null);
    this.tenantsContexts.push(newTenantContext);
    newTenantContext.addUsers(userList); // pragma getContext().users = userList;
    newTenantContext.addTags(tagList);
    newTenantContext.getContext().companies = companyList;

    if (tenantEntity.components && tenantEntity.components[TenantComponents.ORGANIZATION] &&
      tenantEntity.components[TenantComponents.ORGANIZATION].active) {
      for (const siteContextDef of ContextDefinition.TENANT_SITE_LIST) {
        const jsonSite = siteList.find((site) => site.name === siteContextDef.name);
        const siteContext = new SiteContext(jsonSite, newTenantContext);
        const siteAreas = siteAreaList.filter((siteArea) => siteContext.getSite().id === siteArea.siteID);
        for (const siteArea of siteAreas) {
          const siteAreaContext = siteContext.addSiteArea(siteArea);
          const chargingStations = chargingStationList.filter((chargingStation) => siteArea.id === chargingStation.siteAreaID);
          for (const chargingStation of chargingStations) {
            await siteAreaContext.addChargingStation(chargingStation);
          }
        }
        newTenantContext.addSiteContext(siteContext);
      }
    }
    // Create list of unassigned charging stations
    const chargingStations = chargingStationList.filter((chargingStation) => !chargingStation.siteAreaID);
    for (const chargingStation of chargingStations) {
      await newTenantContext.addChargingStation(chargingStation);
    }

    const registrationToken = new ObjectId().toHexString();
    const unregisteredChargingStation15 = await Factory.chargingStation.build({ id: ContextDefinition.CHARGING_STATION_CONTEXTS.UNREGISTERED_OCPP15, ocppVersion: OCPPVersion.VERSION_15 });
    await newTenantContext.addChargingStation(unregisteredChargingStation15, registrationToken);
    const unregisteredChargingStation16 = await Factory.chargingStation.build({ id: ContextDefinition.CHARGING_STATION_CONTEXTS.UNREGISTERED_OCPP16, ocppVersion: OCPPVersion.VERSION_16 });
    await newTenantContext.addChargingStation(unregisteredChargingStation16, registrationToken);
    const invalidChargingStation15 = await Factory.chargingStation.build({ id: ContextDefinition.CHARGING_STATION_CONTEXTS.INVALID_IDENTIFIER_OCPP15, ocppVersion: OCPPVersion.VERSION_15 });
    await newTenantContext.addChargingStation(invalidChargingStation15);
    const invalidChargingStation16 = await Factory.chargingStation.build({ id: ContextDefinition.CHARGING_STATION_CONTEXTS.INVALID_IDENTIFIER_OCPP16, ocppVersion: OCPPVersion.VERSION_16 });
    await newTenantContext.addChargingStation(invalidChargingStation16);
    const unknownChargingStation15 = await Factory.chargingStation.buildChargingStationUnknown({ id: ContextDefinition.CHARGING_STATION_CONTEXTS.UNKNOWN_OCPP15, ocppVersion: OCPPVersion.VERSION_15 });
    await newTenantContext.addChargingStation(unknownChargingStation15);
    const unknownChargingStation16 = await Factory.chargingStation.buildChargingStationUnknown({ id: ContextDefinition.CHARGING_STATION_CONTEXTS.UNKNOWN_OCPP16, ocppVersion: OCPPVersion.VERSION_16 });
    await newTenantContext.addChargingStation(unknownChargingStation16);

    return newTenantContext;
  }

  async cleanUpCreatedContent() {
    for (const tenantContext of this.tenantsContexts) {
      await tenantContext.cleanUpCreatedData();
    }
  }

  _getTenantContextDef(tenantContextName, checkValid = true) {
    const tenantContext = ContextDefinition.TENANT_CONTEXT_LIST.find((context) => context.tenantName === tenantContextName);
    if (!tenantContext && checkValid) {
      throw new Error('Unknown context name ' + tenantContextName);
    }
    return tenantContext;
  }

  _getTenantContext(tenantContextName, checkValid = true) {
    const tenantContextDef = this._getTenantContextDef(tenantContextName, checkValid);
    return this.tenantsContexts.find((tenantContext) => (tenantContext.getTenant().name === tenantContextName));
  }

}
