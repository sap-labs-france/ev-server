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
    let response = await CentralServerService.company.create(company);
    expect(response.status).to.equal(200);
    company.id = response.data.id;
  });

  it('should create a new site', async () => {
    let response = await CentralServerService.site.create(Factory.site.build({companyID: company.id}));
    expect(response.status).to.equal(200);
    expect(response.data.status).to.eql('Success');
  });

  it('should find a newly created site from list', async () => {
    const site = Factory.site.build({companyID: company.id});

    let response = await CentralServerService.site.create(site);
    site.id = response.data.id;

    response = await CentralServerService.site.readAll();
    expect(response.status).to.equal(200);
    expect(response.data).to.have.property('count');
    expect(response.data).to.have.property('result');

    const actualSite = response.data.result.find((element) => element.name === site.name);
    expect(actualSite).to.be.an('object');
    expect(actualSite).to.containSubset(site);
  });

  it('should find a specific site by id', async () => {
    const site = Factory.site.build({companyID: company.id});

    let response = await CentralServerService.site.create(site);
    expect(response.status).to.equal(200);
    site.id = response.data.id;

    response = await CentralServerService.site.readById(site.id);
    expect(response.status).to.equal(200);
    expect(response.data).to.containSubset(site);
  });

});
