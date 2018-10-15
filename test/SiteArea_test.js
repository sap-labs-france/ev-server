const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const Factory = require('./factories/Factory');
const CentralServerService = require('./api/client/CentralServerService');


describe('SiteArea tests', function() {
  this.timeout(10000);
  describe('green cases', function() {
    let site = null;
    let company = null;

    beforeEach(async function() {
      company = Factory.company.build();
      let response = await CentralServerService.company.create(company);
      expect(response.status).to.equal(200);
      company.id = response.data.id;

      site = Factory.site.build({companyID: company.id});
      response = await CentralServerService.site.create(site);
      expect(response.status).to.equal(200);
      site.id = response.data.id;

    });

    it('should create a new SiteAreaArea', async function() {
      let response = await CentralServerService.siteArea.create(Factory.siteArea.build({siteID: site.id}));
      expect(response.status).to.equal(200);
      expect(response.data.status).to.eql('Success');
      expect(response.data).to.have.property('id');
      expect(response.data.id).to.match(/^[a-f0-9]+$/);
    });

    it('should find a newly created siteArea from list', async function() {
      const siteArea = Factory.siteArea.build({siteID: site.id});
      let response = await CentralServerService.siteArea.create(siteArea);
      siteArea.id = response.data.id;
      response = await CentralServerService.siteArea.readAll({});
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('count');

      expect(response.data).to.have.property('result');
      const actualSiteArea = response.data.result.find((element) => element.name === siteArea.name);
      expect(actualSiteArea).to.be.an('object');
      expect(actualSiteArea).to.containSubset(siteArea);
    });

    it('should find a specific siteArea by id', async function() {
      const siteArea = Factory.siteArea.build({siteID: site.id});
      let response = await CentralServerService.siteArea.create(siteArea);
      expect(response.status).to.equal(200);
      siteArea.id = response.data.id;
      response = await CentralServerService.siteArea.readById(siteArea.id);
      expect(response.status).to.equal(200);
      expect(response.data).to.containSubset(siteArea);
    });
  });
  describe('Error cases', function() {
    it('should not create a siteArea without a referenced site', async function() {
      const siteArea = Factory.siteArea.build({siteID: null});
      let response = await CentralServerService.siteArea.create(siteArea);
      expect(response.status).to.equal(500);
    });
  });
});
