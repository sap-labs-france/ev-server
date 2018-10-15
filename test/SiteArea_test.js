const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const Factory = require('./factories/Factory');
const CentralServerService = require('./api/client/CentralServerService');

const centralServerService = new CentralServerService();

describe('SiteArea tests', function() {
  this.timeout(10000);
  describe('green cases', function() {
    let site = null;
    let company = null;

    beforeEach(async function() {
      company = Factory.company.build();
      await centralServerService.company.create(company, (message, response) => {
        expect(message.status).to.equal(200);
        company.id = response.id;
      });

      site = Factory.site.build({companyID: company.id});
      await centralServerService.site.create(site, (message, response) => {
        expect(message.status).to.equal(200);
        site.id = response.id;
      });

    });

    it('should create a new SiteAreaArea', async function() {
      await centralServerService.siteArea.create(Factory.siteArea.build({siteID: site.id}), (message, response) => {
        expect(message.status).to.equal(200);
        expect(response.status).to.eql('Success');
        expect(response).to.have.property('id');
        expect(response.id).to.match(/^[a-f0-9]+$/);
      });
    });

    it('should find a newly created siteArea from list', async function() {
      const siteArea = Factory.siteArea.build({siteID: site.id});
      await centralServerService.siteArea.create(siteArea, ((message, response) => {
        siteArea.id = response.id;
      }));
      await centralServerService.siteArea.readAll({}, (message, response) => {
        expect(message.status).to.equal(200);
        expect(response).to.have.property('count');

        expect(response).to.have.property('result');
        const actualSiteArea = response.result.find((element) => element.name === siteArea.name);
        expect(actualSiteArea).to.be.a('object');
        expect(actualSiteArea).to.containSubset(siteArea);
      });
    });

    it('should find a specific siteArea by id', async function() {
      const siteArea = Factory.siteArea.build({siteID: site.id});
      await centralServerService.siteArea.create(siteArea, ((message, response) => {
        expect(message.status).to.equal(200);
        siteArea.id = response.id;
      }));
      await centralServerService.siteArea.readById(siteArea.id, (message, response) => {
        expect(message.status).to.equal(200);
        expect(response).to.containSubset(siteArea);
      });
    });
  });
  describe('Error cases', function() {
    it('should not create a siteArea without a referenced site', async function() {
      const siteArea = Factory.siteArea.build({siteID: null});
      await centralServerService.siteArea.create(siteArea, (message, response) => {
        expect(message.status).to.equal(500);
      });
    });
  });
});
