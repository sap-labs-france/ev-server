const ChargingStationContext = require('./ChargingStationContext');
class SiteAreaContext {

  constructor(siteArea, tenantContext) {
    this.tenantContext = tenantContext;
    this.chargingStations = [];
    this.siteArea = siteArea;
  }

  async cleanUpCreatedData() {
    // clean up charging stations
    for (const chargingStation of this.chargingStations) {
      // Delegate
      await chargingStation.cleanUpCreatedData();
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

}

module.exports = SiteAreaContext;