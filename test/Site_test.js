const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CentralServerService = require('./api/client/CentralServerService');
const Factory = require('./factories/Factory');


describe('Site tests', function() {
  this.timeout(10000);
  let company = null;
  beforeEach(async () => {
    company = Factory.company.build();
    await CentralServerService.company.create(company, (message, response) => {
      expect(message.status).to.equal(200);
      company.id = response.id;
    });
  });

  it('should create a new site', async () => {
    await CentralServerService.site.create(Factory.site.build({companyID: company.id}), (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
    });
  });

  it('should find a newly created site from list', async () => {
    const site = Factory.site.build({companyID: company.id});
    await CentralServerService.site.create(site, ((message, response) => {
      site.id = response.id;
    }));
    await CentralServerService.site.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');

      expect(response).to.have.property('result');
      const actualSite = response.result.find((element) => element.name === site.name);
      expect(actualSite).to.be.an('object');
      expect(actualSite).to.containSubset(site);
    });
  });

  it('should find a specific site by id', async () => {
    const site = Factory.site.build({companyID: company.id});
    await CentralServerService.site.create(site, (message, response) => {
      expect(message.status).to.equal(200);
      site.id = response.id;
    });
    await CentralServerService.site.readById(site.id, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.containSubset(site);
    });
  });

});
