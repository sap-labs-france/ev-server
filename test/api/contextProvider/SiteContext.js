const SiteAreaContext = require('./SiteAreaContext');
class SiteContext {

  constructor(site, tenantContext) {
    this.tenantContext = tenantContext;
    this.siteAreas = [];
    this.site = site;
    this.createdSiteAreas = [];
  }

  async cleanUpCreatedData() {
    // clean up site areas
    for (const siteArea of this.siteAreas) {
      // delegate
      await siteArea.cleanUpCreatedData();
    }
    // clean up site areas
    for (const siteArea of this.createdSiteAreas) {
      // delegate
      await siteArea.cleanUpCreatedData();
      // Delete
      await this.tenantContext.getAdminCentralServerService().deleteEntity(this.tenantContext.getAdminCentralServerService().siteAreaApi, siteArea.getSiteArea(), false);
    }
  }

  getSite() {
    return this.site;
  }

  getSiteName() {
    return this.site.name;
  }

  setSite(site) {
    this.site = site;
  }

  getSiteArea(siteAreaName) {
    return this.siteAreas.find((siteArea) => siteArea.getSiteArea().name === siteAreaName);
  }

  getSiteAreaContext(siteAreaContext) {
    return this.siteAreas.find((siteArea) => siteArea.getSiteArea().name.endsWith(siteAreaContext));
  }

  getSiteAreas() {
    return this.siteAreas.concat(this.createdSiteAreas);
  }

  addSiteArea(siteArea) {
    const siteAreaContext = new SiteAreaContext(siteArea, this.tenantContext)
    this.siteAreas.push(siteAreaContext);
    return siteAreaContext;
  }

  async createSiteArea(site, chargingStations, siteArea) {
    siteArea.siteID = (site && site.id ? (!siteArea.siteID || siteArea.siteID !== site.id ? site.id : siteArea.siteID) : null);
    siteArea.chargeBoxIDs = (Array.isArray(chargingStations) && (!siteArea.chargeBoxIDs || siteArea.chargeBoxIDs.length === 0)  ? chargingStations.map(chargingStation => chargingStation.id) : []);
    const createdSiteArea = await this.tenantContext.getAdminCentralServerService().createEntity(this.tenantContext.getAdminCentralServerService().siteAreaApi, siteArea);
    this.createdSiteAreas.push(new SiteAreaContext(createdSiteArea, this.tenantContext));
    return createdSiteArea;
  }

}

module.exports = SiteContext;