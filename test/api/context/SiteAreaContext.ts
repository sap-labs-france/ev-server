import ChargingStationContext from './ChargingStationContext';
import TenantContext from './TenantContext';

export default class SiteAreaContext {

  private tenantContext: TenantContext;
  private chargingStations: ChargingStationContext[];
  private siteArea: any;

  constructor(siteArea, tenantContext: TenantContext) {
    this.tenantContext = tenantContext;
    this.chargingStations = [];
    this.siteArea = siteArea;
  }

  async cleanUpCreatedData() {
    // Clean up charging stations
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
    return this.chargingStations;
  }

  getChargingStation(chargingStationID) {
    // Search in context list
    return this.chargingStations.find((chargingStationContext) => chargingStationContext.getChargingStation().id === chargingStationID);
  }

  getChargingStationContext(chargingStationContext) {
    // Search in context list
    return this.chargingStations.find((chargingStation) => chargingStation.getChargingStation().id.startsWith(chargingStationContext));
  }

  async addChargingStation(chargingStation) {
    const chargingStationContext = new ChargingStationContext(chargingStation, this.tenantContext);
    await chargingStationContext.initialize();
    this.chargingStations.push(chargingStationContext);
  }

  async assignChargingStation(chargingStation) {
    const readChargingStation = (await this.tenantContext.getAdminCentralServerService().getEntityById(this.tenantContext.getAdminCentralServerService().chargingStationApi, chargingStation, false)).data;
    readChargingStation.siteArea = this.siteArea;
    const response = await this.tenantContext.getAdminCentralServerService().chargingStationApi.update(readChargingStation);
    return response;
  }

}
