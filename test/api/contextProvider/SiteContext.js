const SiteAreaContext = require('./SiteAreaContext');
class SiteContext {

  constructor(site, tenantContext) {
    this.tenantContext = tenantContext;
    this.siteAreas = [];
    this.site = site;
    
  }

  async cleanUpCreatedData() {
    // clean up site areas
    for (const siteArea of this.siteAreas) {
      // delegate
      await siteArea.cleanUpCreatedData();
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

}

module.exports = SiteContext;