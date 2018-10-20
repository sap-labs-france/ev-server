const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const Factory = require('../factories/Factory');
const CentralServerService = require('./client/CentralServerService');

describe('Company, Site, Site Area tests', function() {
  this.timeout(10000);

  describe('Green cases', function() {
    beforeEach(async () => {
      // Create the Company
      this.newCompany = await CentralServerService.createEntity(
        CentralServerService.company, Factory.company.build());
      // Check
      expect(this.newCompany).to.not.be.null;
      // Create the Site
      this.newSite = await CentralServerService.createEntity(
        CentralServerService.site, Factory.site.build({ companyID: this.newCompany.id }));
      // Check
      expect(this.newSite).to.not.be.null;
      // Create the entity
      this.newSiteArea = await CentralServerService.createEntity(
        CentralServerService.siteArea, Factory.siteArea.build({ siteID: this.newSite.id }));
        expect(this.newSiteArea).to.not.be.null;
      });
  
    afterEach(async () => {
      // Delete the Site Area
      await CentralServerService.deleteEntity(
        CentralServerService.siteArea, this.newSiteArea, false);
      // Delete the Site
      await CentralServerService.deleteEntity(
        CentralServerService.site, this.newSite, false);
      // Delete the Company
      await CentralServerService.deleteEntity(
        CentralServerService.company, this.newCompany, false);
    });
    
    it('Should delete site which will delete the site area', async () => {
      // Delete the Site
      await CentralServerService.deleteEntity(
        CentralServerService.site, this.newSite);
      // Check Site does not exist
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.site, this.newSite);
      // Check Site Area does not exist
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.siteArea, this.newSiteArea);
    });

    it('Should delete company which will delete the site area and the site area', async () => {
      // Delete the Site
      await CentralServerService.deleteEntity(
        CentralServerService.company, this.newCompany);
      // Check Company does not exist
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.company, this.newCompany);
      // Check Site does not exist
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.site, this.newSite);
      // Check Site Area does not exist
      await CentralServerService.checkDeletedEntityById(
        CentralServerService.siteArea, this.newSiteArea);
    });
  });
});
