import { ChargePointStatus, OCPPVersion } from '../../../src/types/ocpp/OCPPServer';

import CentralServerService from '../client/CentralServerService';
import ChargingStationContext from './ChargingStationContext';
import ContextDefinition from './ContextDefinition';
import Factory from '../../factories/Factory';
import OCPPJsonService15 from '../ocpp/soap/OCPPSoapService15';
import OCPPJsonService16 from '../ocpp/json/OCPPJsonService16';
import OCPPService from '../ocpp/OCPPService';
import RegistrationToken from '../../../src/types/RegistrationToken';
import SiteArea from '../../../src/types/SiteArea';
import SiteAreaContext from './SiteAreaContext';
import SiteContext from './SiteContext';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../src/types/Tenant';
import Utils from '../../../src/utils/Utils';
import { Voltage } from '../../../src/types/ChargingStation';
import config from '../../config';
import { expect } from 'chai';
import { faker } from '@faker-js/faker';

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
      assets: [],
      users: [],
      tags: [],
      siteContexts: [],
      chargingStations: [],
      createdUsers: [],
      createdCompanies: [],
      createdSites: [],
      createdSiteAreas: [],
      createdChargingStations: []
    };
  }

  async initialize(tokenID: string = null, siteAreaID: string = null) {
    if (!tokenID) {
      tokenID = await this.createRegistrationToken(siteAreaID);
    }
    // FIXME: define helpers to build the URL
    this.ocpp16 = new OCPPJsonService16(`${config.get('ocpp.json.scheme')}://${config.get('ocpp.json.host')}:${config.get('ocpp.json.port')}/OCPP16/${this.tenant.id}/${tokenID}`, this.ocppRequestHandler);
    this.ocpp15 = new OCPPJsonService15(`${config.get('ocpp.soap.scheme')}://${config.get('ocpp.soap.host')}:${config.get('ocpp.soap.port')}/OCPP15?TenantID=${this.tenant.id}%26Token=${tokenID}`);
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

  async getOCPPServiceForContextCreation(ocppVersion: string, siteAreaID: string = null): Promise<OCPPService> {
    let registrationToken = null;
    if (siteAreaID) {
      registrationToken = await this.getRegistrationToken(siteAreaID);
    }
    if (!registrationToken) {
      await this.initialize(null, siteAreaID);
    }
    if (registrationToken) {
      await this.initialize(registrationToken.id);
    }
    if (ocppVersion === OCPPVersion.VERSION_16) {
      return this.ocpp16;
    } else if (ocppVersion === OCPPVersion.VERSION_15) {
      return this.ocpp15;
    }
    throw new Error('unknown ocpp version');
  }

  async getOCPPService(ocppVersion: string, token: string = null): Promise<OCPPService> {
    if (!this.ocpp15 || !this.ocpp16 || token) {
      await this.initialize(token);
    }
    if (ocppVersion === OCPPVersion.VERSION_16) {
      return this.ocpp16;
    } else if (ocppVersion === OCPPVersion.VERSION_15) {
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
      return this.context.siteContexts.concat(this.context.createdSites).find((siteContext) => siteContext.getSiteName() === siteName);
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
    return this.context.chargingStations.find((chargingStationContext) => chargingStationContext.getChargingStation().id === chargingStationID);
  }

  getChargingStationContext(chargingStationContext) {
    // Search in context list
    return this.context.chargingStations.find((chargingStation) => chargingStation.getChargingStation().id.startsWith(chargingStationContext));
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

  getUserContext(params) {
    // Structure { id = user ID, email = user mail, role = user role, status = user status, assignedToSite = boolean) {
    if (params.id || params.email) {
      return this.context.users.find((user) => user.id === params.id || user.email === params.email);
    }
    return this.context.users.find((user) => {
      let conditionMet = null;
      for (const key in params) {
        const userContextDef = ContextDefinition.TENANT_USER_LIST.find((userList) => userList.id === user.id);
        if (Utils.objectHasProperty(user, key)) {
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
        } else if (key === 'withTags') {
          user.tags = this.context.tags.filter((tag) => tag.userID === user.id);
          if (conditionMet !== null) {
            conditionMet = conditionMet && (params[key] ? !Utils.isEmptyArray(user.tags) : Utils.isEmptyArray(user.tags));
          } else {
            conditionMet = (params[key] ? !Utils.isEmptyArray(user.tags) : Utils.isEmptyArray(user.tags));
          }
        }
      }
      return conditionMet;
    });

  }

  /**
   * Add default context user
   * Do not user for newly created users
   *
   * @param {*} users
   * @memberof TenantContext
   */
  addUsers(users) {
    for (const user of users) {
      if (!Utils.objectHasProperty(user, 'password')) {
        user.password = config.get('admin.password');
      }
      if (!Utils.objectHasProperty(user, 'centralServerService')) {
        user.centralServerService = new CentralServerService(this.tenant.subdomain, user);
      }
      this.context.users.push(user);
    }
  }

  addTags(tags) {
    this.context.tags = tags;
  }

  async createUser(user = Factory.user.build(), loggedUser = null) {
    const createdUser = await this.centralAdminServerService.createEntity(this.centralAdminServerService.userApi, user);
    if (!Utils.objectHasProperty(createdUser, 'password')) {
      createdUser.password = config.get('admin.password');
    }
    if (!Utils.objectHasProperty(createdUser, 'centralServerService')) {
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
    userIDs: users.map((user) => user.id)
  }), loggedUser = null) {
    const siteContext = new SiteContext(site.name, this);
    const createdSite = await this.centralAdminServerService.createEntity(this.centralAdminServerService.siteApi, site);
    siteContext.setSite(createdSite);
    this.context.siteContexts.push(siteContext);
    return siteContext;
  }

  async createSiteArea(site, chargingStations, siteArea) {
    siteArea.siteID = (site && site.id ? (!siteArea.siteID || siteArea.siteID !== site.id ? site.id : siteArea.siteID) : null);
    siteArea.chargeBoxIDs = (Array.isArray(chargingStations) && Utils.isEmptyArray(siteArea.chargeBoxIDs) ? chargingStations.map((chargingStation) => chargingStation.id) : []);
    const createdSiteArea = await this.centralAdminServerService.createEntity(this.centralAdminServerService.siteAreaApi, siteArea);
    this.context.createdSiteAreas.push(new SiteAreaContext(createdSiteArea, this));
    return createdSiteArea;
  }

  async createChargingStation(ocppVersion, chargingStation = Factory.chargingStation.build({
    id: faker.random.alphaNumeric(12)
  }), connectorsDef = null, siteArea: SiteArea = null) {
    const ocppService = await this.getOCPPServiceForContextCreation(ocppVersion, siteArea?.id);
    const response = await ocppService.executeBootNotification(chargingStation.id, chargingStation);
    expect(response).to.not.be.null;
    expect(response.status).to.eql('Accepted');
    expect(response).to.have.property('currentTime');
    let createdChargingStation = await this.getAdminCentralServerService().getEntityById(
      this.getAdminCentralServerService().chargingStationApi, chargingStation);
    expect(createdChargingStation.maximumPower).to.eql(44160);
    expect(createdChargingStation.powerLimitUnit).to.eql('A');
    for (let i = 0; i < (connectorsDef ? connectorsDef.length : 2); i++) {
      createdChargingStation.connectors[i] = {
        connectorId: i + 1,
        status: (connectorsDef && connectorsDef[i].status ? connectorsDef[i].status : ChargePointStatus.AVAILABLE),
        errorCode: (connectorsDef && connectorsDef[i].errorCode ? connectorsDef[i].errorCode : 'NoError'),
        timestamp: (connectorsDef && connectorsDef[i].timestamp ? connectorsDef[i].timestamp : new Date().toISOString()),
        type: (connectorsDef && connectorsDef[i].type ? connectorsDef[i].type : 'U'),
        power: (connectorsDef && connectorsDef[i].power ? connectorsDef[i].power : 22170),
        numberOfConnectedPhase: (connectorsDef && connectorsDef[i].numberOfConnectedPhase ? connectorsDef[i].numberOfConnectedPhase : 3),
        amperage: (connectorsDef && connectorsDef[i].amperage ? connectorsDef[i].amperage : 96),
      };
    }
    for (const connector of createdChargingStation.connectors) {
      await ocppService.executeStatusNotification(createdChargingStation.id, connector);
    }
    createdChargingStation = await this.getAdminCentralServerService().getEntityById(
      this.getAdminCentralServerService().chargingStationApi, chargingStation);
    // Charging Station
    expect(createdChargingStation.voltage).to.eql(Voltage.VOLTAGE_230);
    if (siteArea) {
      expect(createdChargingStation.siteID).to.eql(siteArea.siteID);
    }
    // Connectors
    expect(createdChargingStation.connectors.length).to.eql(2,
      `Number of connector of charging station ${createdChargingStation.id} must be 2`);
    expect(createdChargingStation.connectors[0].power).to.eql(22080,
      `Connector ID 1 of charging station ${createdChargingStation.id} must have 22080 W`);
    expect(createdChargingStation.connectors[0].amperage).to.eql(96,
      `Connector ID 1 of charging station ${createdChargingStation.id} must have 96 A`);
    expect(createdChargingStation.connectors[0].type).to.eql('T2',
      `Connector ID 1 of charging station ${createdChargingStation.id} must have Type 2 connector`);
    if (siteArea) {
      expect(createdChargingStation.connectors[0].phaseAssignmentToGrid).to.eql({
        'csPhaseL1': 'L1',
        'csPhaseL2': 'L2',
        'csPhaseL3': 'L3',
      },
      `Connector ID 1 of charging station ${createdChargingStation.id} must have default phase assignment`);
    }
    expect(createdChargingStation.connectors[1].power).to.eql(22080,
      `Connector ID 2 of charging station ${createdChargingStation.id} must have 22080 W`);
    expect(createdChargingStation.connectors[1].amperage).to.eql(96,
      `Connector ID 2 of charging station ${createdChargingStation.id} must have 96 A`);
    expect(createdChargingStation.connectors[1].type).to.eql('T2',
      `Connector ID 2 of charging station ${createdChargingStation.id} must have Type 2 connector`);
    if (siteArea) {
      expect(createdChargingStation.connectors[1].phaseAssignmentToGrid).to.eql({
        'csPhaseL1': 'L1',
        'csPhaseL2': 'L2',
        'csPhaseL3': 'L3',
      },
      `Connector ID 2 of charging station ${createdChargingStation.id} must have default phase assignment`);
    }
    // Charge Points
    expect(createdChargingStation.chargePoints.length).to.eql(1,
      `Number of charge point of charging station ${createdChargingStation.id} must be 1`);
    expect(createdChargingStation.chargePoints[0].currentType).to.eql('AC');
    expect(createdChargingStation.chargePoints[0].numberOfConnectedPhase).to.eql(3,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} must have 3 phases`);
    expect(createdChargingStation.chargePoints[0].cannotChargeInParallel).to.eql(false,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} cannot charge in parallel`);
    expect(createdChargingStation.chargePoints[0].sharePowerToAllConnectors).to.eql(false,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} cannot share power`);
    expect(createdChargingStation.chargePoints[0].excludeFromPowerLimitation).to.eql(false,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} cannot be excluded from power limitation`);
    expect(createdChargingStation.chargePoints[0].ocppParamForPowerLimitation).to.eql('maxintensitysocket',
      `Charge Point ID 1 of charging station ${createdChargingStation.id} must have OCPP param 'maxintensitysocket'`);
    const createdCS = new ChargingStationContext(createdChargingStation, this);
    await createdCS.initialize();
    this.context.createdChargingStations.push(createdCS);
    return createdCS;
  }

  async createSinglePhasedChargingStation(ocppVersion, chargingStation = Factory.chargingStation.buildChargingStationSinglePhased({
    id: faker.random.alphaNumeric(12)
  }), connectorsDef = null, siteArea: SiteArea = null) {
    const ocppService = await this.getOCPPServiceForContextCreation(ocppVersion, siteArea?.id);
    const response = await ocppService.executeBootNotification(chargingStation.id, chargingStation);
    expect(response).to.not.be.null;
    expect(response.status).to.eql('Accepted');
    expect(response).to.have.property('currentTime');
    let createdChargingStation = await this.getAdminCentralServerService().getEntityById(
      this.getAdminCentralServerService().chargingStationApi, chargingStation);
    expect(createdChargingStation.maximumPower).to.eql(14720);
    expect(createdChargingStation.powerLimitUnit).to.eql('A');
    for (let i = 0; i < (connectorsDef ? connectorsDef.length : 2); i++) {
      createdChargingStation.connectors[i] = {
        connectorId: i + 1,
        status: (connectorsDef && connectorsDef[i].status ? connectorsDef[i].status : ChargePointStatus.AVAILABLE),
        errorCode: (connectorsDef && connectorsDef[i].errorCode ? connectorsDef[i].errorCode : 'NoError'),
        timestamp: (connectorsDef && connectorsDef[i].timestamp ? connectorsDef[i].timestamp : new Date().toISOString()),
        type: (connectorsDef && connectorsDef[i].type ? connectorsDef[i].type : 'U'),
        power: (connectorsDef && connectorsDef[i].power ? connectorsDef[i].power : 7360),
        numberOfConnectedPhase: (connectorsDef && connectorsDef[i].numberOfConnectedPhase ? connectorsDef[i].numberOfConnectedPhase : 1),
        amperage: (connectorsDef && connectorsDef[i].amperage ? connectorsDef[i].amperage : 654),
      };
    }
    for (const connector of createdChargingStation.connectors) {
      await ocppService.executeStatusNotification(createdChargingStation.id, connector);
    }
    createdChargingStation = await this.getAdminCentralServerService().getEntityById(
      this.getAdminCentralServerService().chargingStationApi, chargingStation);
    // Charging Station
    expect(createdChargingStation.voltage).to.eql(Voltage.VOLTAGE_230);
    if (siteArea) {
      expect(createdChargingStation.siteID).to.eql(siteArea.siteID);
    }
    // Connectors
    expect(createdChargingStation.connectors.length).to.eql(2,
      `Number of connector of charging station ${createdChargingStation.id} must be 2`);
    expect(createdChargingStation.connectors[0].power).to.eql(7360,
      `Connector ID 1 of charging station ${createdChargingStation.id} must have 7360 W`);
    expect(createdChargingStation.connectors[0].amperage).to.eql(32,
      `Connector ID 1 of charging station ${createdChargingStation.id} must have 32 A`);
    expect(createdChargingStation.connectors[0].type).to.eql('T2',
      `Connector ID 1 of charging station ${createdChargingStation.id} must have Type 2 connector`);
    if (siteArea?.numberOfPhases === 3) {
      expect(createdChargingStation.connectors[0].phaseAssignmentToGrid).to.eql({
        'csPhaseL1': 'L1',
        'csPhaseL2': null,
        'csPhaseL3': null,
      },
      `Connector ID 1 of charging station ${createdChargingStation.id} must have default phase assignment`);
    } else {
      expect(createdChargingStation.connectors[0].phaseAssignmentToGrid).to.eql(null,
        `Connector ID 1 of charging station ${createdChargingStation.id} must not have phase assignment to grid`);
    }
    expect(createdChargingStation.connectors[1].power).to.eql(7360,
      `Connector ID 2 of charging station ${createdChargingStation.id} must have 7360 W`);
    expect(createdChargingStation.connectors[1].amperage).to.eql(32,
      `Connector ID 2 of charging station ${createdChargingStation.id} must have 32 A`);
    expect(createdChargingStation.connectors[1].type).to.eql('T2',
      `Connector ID 2 of charging station ${createdChargingStation.id} must have Type 2 connector`);
    if (siteArea?.numberOfPhases === 3) {
      expect(createdChargingStation.connectors[1].phaseAssignmentToGrid).to.eql({
        'csPhaseL1': 'L1',
        'csPhaseL2': null,
        'csPhaseL3': null,
      },
      `Connector ID 2 of charging station ${createdChargingStation.id} must have default phase assignment`);
    } else {
      expect(createdChargingStation.connectors[1].phaseAssignmentToGrid).to.eql(null,
        `Connector ID 2 of charging station ${createdChargingStation.id} must not have phase assignment to grid`);
    }
    // Charge Points
    expect(createdChargingStation.chargePoints.length).to.eql(1,
      `Number of charge point of charging station ${createdChargingStation.id} must be 1`);
    expect(createdChargingStation.chargePoints[0].currentType).to.eql('AC');
    expect(createdChargingStation.chargePoints[0].numberOfConnectedPhase).to.eql(1,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} must have 1 phases`);
    expect(createdChargingStation.chargePoints[0].cannotChargeInParallel).to.eql(false,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} cannot charge in parallel`);
    expect(createdChargingStation.chargePoints[0].sharePowerToAllConnectors).to.eql(false,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} cannot share power`);
    expect(createdChargingStation.chargePoints[0].excludeFromPowerLimitation).to.eql(false,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} cannot be excluded from power limitation`);
    expect(createdChargingStation.chargePoints[0].ocppParamForPowerLimitation).to.eql('maxintensitysocket',
      `Charge Point ID 1 of charging station ${createdChargingStation.id} must have OCPP param 'maxintensitysocket'`);
    const createdCS = new ChargingStationContext(createdChargingStation, this);
    await createdCS.initialize();
    this.context.createdChargingStations.push(createdCS);
    return createdCS;
  }

  async createChargingStationDC(ocppVersion, chargingStation = Factory.chargingStation.build({
    id: faker.random.alphaNumeric(12)
  }), connectorsDef = null, siteArea = null) {
    const ocppService = await this.getOCPPServiceForContextCreation(ocppVersion, siteArea?.id);
    const response = await ocppService.executeBootNotification(chargingStation.id, chargingStation);
    expect(response).to.not.be.null;
    expect(response.status).to.eql('Accepted');
    expect(response).to.have.property('currentTime');
    let createdChargingStation = await this.getAdminCentralServerService().getEntityById(
      this.getAdminCentralServerService().chargingStationApi, chargingStation);
    expect(createdChargingStation.maximumPower).to.eql(150000);
    expect(createdChargingStation.powerLimitUnit).to.eql('W');
    for (let i = 0; i < (connectorsDef ? connectorsDef.length : 2); i++) {
      createdChargingStation.connectors[i] = {
        connectorId: i + 1,
        status: (connectorsDef && connectorsDef[i].status ? connectorsDef[i].status : ChargePointStatus.AVAILABLE),
        errorCode: (connectorsDef && connectorsDef[i].errorCode ? connectorsDef[i].errorCode : 'NoError'),
        timestamp: (connectorsDef && connectorsDef[i].timestamp ? connectorsDef[i].timestamp : new Date().toISOString()),
        type: (connectorsDef && connectorsDef[i].type ? connectorsDef[i].type : 'CCS'),
        power: (connectorsDef && connectorsDef[i].power ? connectorsDef[i].power : 150000),
        numberOfConnectedPhase: (connectorsDef && connectorsDef[i].numberOfConnectedPhase ? connectorsDef[i].numberOfConnectedPhase : 3),
        amperage: (connectorsDef && connectorsDef[i].amperage ? connectorsDef[i].amperage : 96),
      };
    }
    for (const connector of createdChargingStation.connectors) {
      await ocppService.executeStatusNotification(createdChargingStation.id, connector);
    }
    createdChargingStation = await this.getAdminCentralServerService().getEntityById(
      this.getAdminCentralServerService().chargingStationApi, chargingStation);
    // Charging Station
    expect(createdChargingStation.voltage).to.eql(Voltage.VOLTAGE_230);
    if (siteArea) {
      expect(createdChargingStation.siteID).to.eql(siteArea.siteID);
    }
    // Connectors
    expect(createdChargingStation.connectors.length).to.eql(2,
      `Number of connector of charging station ${createdChargingStation.id} must be 2`);
    expect(createdChargingStation.connectors[0].power).to.eql(150000,
      `Connector ID 1 of charging station ${createdChargingStation.id} must have 150000 W`);
    // pragma expect(createdChargingStation.connectors[0].amperage).to.eql(654,
    //   `Connector ID 1 of charging station ${createdChargingStation.id} must have 654 A`);
    expect(createdChargingStation.connectors[0].type).to.eql('CCS',
      `Connector ID 1 of charging station ${createdChargingStation.id} must have CCS connector`);
    if (siteArea) {
      expect(createdChargingStation.connectors[0].phaseAssignmentToGrid).to.eql({
        'csPhaseL1': 'L1',
        'csPhaseL2': 'L2',
        'csPhaseL3': 'L3',
      },
      `Connector ID 1 of charging station ${createdChargingStation.id} must have default phase assignment`);
    }
    expect(createdChargingStation.connectors[1].power).to.eql(150000,
      `Connector ID 2 of charging station ${createdChargingStation.id} must have 150000 W`);
    // pragma expect(createdChargingStation.connectors[1].amperage).to.eql(654,
    //   `Connector ID 2 of charging station ${createdChargingStation.id} must have 654 A`);
    expect(createdChargingStation.connectors[1].type).to.eql('CCS',
      `Connector ID 2 of charging station ${createdChargingStation.id} must have CCS connector`);
    if (siteArea) {
      expect(createdChargingStation.connectors[1].phaseAssignmentToGrid).to.eql({
        'csPhaseL1': 'L1',
        'csPhaseL2': 'L2',
        'csPhaseL3': 'L3',
      },
      `Connector ID 2 of charging station ${createdChargingStation.id} must have default phase assignment`);
    }
    // Charge Points
    expect(createdChargingStation.chargePoints.length).to.eql(1,
      `Number of charge point of charging station ${createdChargingStation.id} must be 1`);
    expect(createdChargingStation.chargePoints[0].currentType).to.eql('DC');
    expect(createdChargingStation.chargePoints[0].numberOfConnectedPhase).to.eql(3,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} must have 3 phases`);
    expect(createdChargingStation.chargePoints[0].cannotChargeInParallel).to.eql(false,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} cannot charge in parallel`);
    expect(createdChargingStation.chargePoints[0].sharePowerToAllConnectors).to.eql(true,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} cannot share power`);
    expect(createdChargingStation.chargePoints[0].excludeFromPowerLimitation).to.eql(false,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} cannot be excluded from power limitation`);
    expect(createdChargingStation.chargePoints[0].ocppParamForPowerLimitation).to.eql('Device/GridCurrent',
      `Charge Point ID 1 of charging station ${createdChargingStation.id} must have OCPP param 'Device/GridCurrent'`);
    expect(createdChargingStation.chargePoints[0].efficiency).to.eql(95,
      `Charge Point ID 1 of charging station ${createdChargingStation.id} must have efficiency 95`);
    const createdCS = new ChargingStationContext(createdChargingStation, this);
    await createdCS.initialize();
    this.context.createdChargingStations.push(createdCS);
    return createdCS;
  }

  async createRegistrationToken(siteAreaID: string = null): Promise<string> {
    const registrationTokenResponse = await this.centralAdminServerService.registrationApi.create({
      description: `Test Token for site area ${siteAreaID}`,
      siteAreaID: siteAreaID
    });
    expect(registrationTokenResponse.status).eq(StatusCodes.OK);
    expect(registrationTokenResponse.data).not.null;
    expect(registrationTokenResponse.data.id).not.null;
    return registrationTokenResponse.data.id;
  }

  async getRegistrationToken(siteAreaID: string): Promise<RegistrationToken> {
    const registrationTokenResponse = await this.centralAdminServerService.registrationApi.readAll({ SiteAreaID: siteAreaID });
    expect(registrationTokenResponse.status).eq(StatusCodes.OK);
    expect(registrationTokenResponse.data).not.null;
    expect(registrationTokenResponse.data.id).not.null;
    if (registrationTokenResponse.data.result.length !== 0) {
      return registrationTokenResponse.data.result[0];
    }
    return null;
  }

  findSiteContextFromSiteArea(siteArea) {
    return this.getSiteContexts().find((context) => context.siteAreas.find((tmpSiteArea) => siteArea.id === tmpSiteArea.id));
  }

  findSiteContextFromChargingStation(chargingStation) {
    return this.getSiteContexts().find((context) => context.chargingStations.find((tmpChargingStation) => tmpChargingStation.id === chargingStation.id));
  }

  async close() {
    if (this.ocpp16) {
      this.ocpp16.closeConnection();
    }
  }

}
