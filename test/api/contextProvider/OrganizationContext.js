class OrganizationContext {

  constructor(organizationContextName) {
    this.contextName = organizationContextName;
    this.chargingStations = [];
    this.siteAreas = [];
    this.sites = [];
    this.transactionsGenerated = [];
  }

  async destroy(centralServerService) {
    await this.siteAreas.forEach(siteArea => centralServerService.deleteEntity(
      centralServerService.siteAreaApi, siteArea, false));
    await this.sites.forEach(site => centralServerService.deleteEntity(
      centralServerService.siteApi, site, false));
    await this.context.chargingStations.forEach(chargingStation => centralServerService.deleteEntity(
      centralServerService.chargingStationApi, chargingStation, false));
    this.transactionsGenerated = [];
  }

  getOrganizationContextName() {
    return this.contextName;
  }

  getSites() {
    return this.sites;
  }

  getSiteAreas() {
    return this.siteAreas;
  }

  getChargingStations() {
    return this.chargingStations;
  }

  getChargingStation(chargingStationID) {
    return this.chargingStations.find(chargingStation => {return chargingStation.id === chargingStationID;});
  }

  getTransactionsGenerated(chargingStation = null) {
    if (chargingStation) {
      return this.transactionsGenerated.find((transactions) => { transactions.chargingStationId === chargingStation.id;});
    } else {
      return this.transactionsGenerated;
    }
  }

  addTransactionStarted(chargingStationID, transaction) {
    const transactions = this.getTransactionsGenerated(chargingStationID);
    if (transactions) {
      transactions.transactionsStarted.push(transaction);
    }
  }

  addTransactionStopped(chargingStationID, transaction) {
    const transactions = this.getTransactionsGenerated(chargingStationID);
    if (transactions) {
      transactions.transactionsStopped.push(transaction);
    }
  }

  async addSite(site, centralServerService) {
    const createdSite = await centralServerService.createEntity(centralServerService.siteApi, site);
    this.sites.push(createdSite);
    return createdSite;
  }

  async addSiteArea(site, chargingStations, siteArea, centralServerService) {
    siteArea.siteID = (site && site.id ? (!siteArea.siteID || siteArea.siteID !== site.id ? site.id : siteArea.siteID) : null);
    siteArea.chargeBoxIDs = (Array.isArray(chargingStations) && (!siteArea.chargeBoxIDs || siteArea.chargeBoxIDs.length === 0)  ? chargingStations.map(chargingStation => chargingStation.id) : []);
    const createdSiteArea = await centralServerService.createEntity(centralServerService.siteAreaApi, siteArea);
    this.siteAreas.push(createdSiteArea);
    return createdSiteArea;
  }

  async addChargingStation(createdChargingStation) {
    this.chargingStations.push(createdChargingStation);
    this.transactionsGenerated.push({
      chargingStationId: createdChargingStation.id,
      transactionsStarted: [],
      transactionsStopped: []
    });
    return createdChargingStation;
  }
}

module.exports = OrganizationContext;