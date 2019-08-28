import SiteAreaContext from './SiteAreaContext';
import TenantContext from './TenantContext';

export default class SiteContext {

  private tenantContext: TenantContext;
  private siteAreas: SiteAreaContext[];
  private site: any;

  constructor(site, tenantContext: TenantContext) {
    this.tenantContext = tenantContext;
    this.siteAreas = [];
    this.site = site;
  }

  async cleanUpCreatedData() {
    // Clean up site areas
    for (const siteArea of this.siteAreas) {
      // Delegate
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
    return this.siteAreas;
  }

  addSiteArea(siteArea) {
    const siteAreaContext = new SiteAreaContext(siteArea, this.tenantContext);
    this.siteAreas.push(siteAreaContext);
    return siteAreaContext;
  }

}
