const faker = require('faker');
const Factory = require('../../factories/Factory');
const {
  SITE_CONTEXTS
} = require('./ContextConstants');

const ChargingStationContext = require('./ChargingStationContext');
class SiteAreaContext {

  constructor(siteArea, tenantContext) {
    this.tenantContext = tenantContext;
    this.chargingStations = [];
    this.siteArea = siteArea;
    this.createdChargingStations = [];
  }

  async cleanUpCreatedData() {
    // clean up charging stations
    for (const chargingStation of this.chargingStations) {
      // Delegate
      await chargingStation.cleanUpCreatedData();
    }
    // clean up charging stations
    for (const chargingStation of this.createdChargingStations) {
      // Delegate
      await chargingStation.cleanUpCreatedData();
      // Delete CS
      await this.tenantContext.getAdminCentralServerService().deleteEntity(this.tenantContext.getAdminCentralServerService().chargingStationApi, chargingStation, false);
    }
  }

  getSiteAreaName() {
    return this.siteArea.name;
  }

  setSiteArea(siteArea) {
    this.siteArea = siteArea;
  }

  getSiteArea() {
    return this.siteArea;
  }

  getChargingStations() {
    return this.chargingStations.concat(this.createChargingStation);
  }

  getChargingStation(chargingStationID) {
    // search in context list
    return this.chargingStations.concat(this.createChargingStation).find(chargingStationContext => {return chargingStationContext.getChargingStation().id === chargingStationID;});
  }

  getChargingStationContext(chargingStationContext) {
    // search in context list
    return this.chargingStations.concat(this.createChargingStation).find(chargingStation => {return chargingStation.getChargingStation().id.startsWith(chargingStationContext);});
  }

  addChargingStation(chargingStation) {
    const charginStationContext = new ChargingStationContext(chargingStation, this.tenantContext);
    this.chargingStations.push(charginStationContext);
  }

  async assignChargingStation(chargingStation) {
    const readChargingStation = (await this.tenantContext.getAdminCentralServerService().getEntityById(this.tenantContext.getAdminCentralServerService().chargingStationApi, chargingStation, false)).data;
    readChargingStation.siteArea = this.siteArea;
    const response = await this.tenantContext.getAdminCentralServerService().chargingStationApi.updateParams(readChargingStation);
    return response;
  }

  async createChargingStation(ocppVersion, chargingStation = Factory.chargingStation.build({
    id: faker.random.alphaNumeric(12)
  }), connectorsDef = null) {
    const response = await this.tenantContext.getOCPPService(ocppVersion).executeBootNotification(
      chargingStation.id, chargingStation);
    const createdChargingStation = await this.tenantContext.getAdminCentralServerService().getEntityById(
      this.tenantContext.getAdminCentralServerService().chargingStationApi, chargingStation);
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
      const responseNotif = await this.tenantContext.getOCPPService(ocppVersion).executeStatusNotification(createdChargingStation.id, connector);
    }
    if (this.siteArea.name !== SITE_CONTEXTS.NO_SITE) {
      //assign to Site Area
      createdChargingStation.siteArea = this.siteArea;
      await this.tenantContext.getAdminCentralServerService().updateEntity(
        this.tenantContext.getAdminCentralServerService().chargingStationApi, createdChargingStation);
    }
    const createdCS = new ChargingStationContext(createdChargingStation, this.tenantContext);
    this.createdChargingStations.push(createdCS);
    return createdCS;
  }
}

module.exports = SiteAreaContext;