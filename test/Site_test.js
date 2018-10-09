const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CompanyApi = require('./api/client/company');
const SiteApi = require('./api/client/site');
const CompanyFactory = require('./factories/company');
const SiteFactory = require('./factories/site');
const BaseApi = require('./api/client/utils/baseApi');
const AuthenticatedBaseApi = require('./api/client/utils/authenticatedBaseApi');
const config = require('./config');

let company = null;
const authenticatedBaseApi = new AuthenticatedBaseApi(config.get('admin.username'), config.get('admin.password'), new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`));
let companyApi = new CompanyApi(authenticatedBaseApi);
let siteApi = new SiteApi(authenticatedBaseApi);


describe('Site tests', function() {
  this.timeout(10000);
  beforeEach(async () => {
    company = null;
    const companyToCreate = CompanyFactory.build();
    await companyApi.create(companyToCreate);
    await companyApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      company = response.result.find((element) => element.name === companyToCreate.name);
    });
  });

  it('should create a new site', async () => {
    await siteApi.create(SiteFactory.build({companyID: company.id}), (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
    });
  });

  it('should find a newly created site from list', async () => {
    const site = SiteFactory.build({companyID: company.id});
    await siteApi.readAll({Limit: 1}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
    });
    await siteApi.create(site, (message, response) => expect(message.status).to.equal(200));
    delete site.userIDs;
    await siteApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      expect(response).to.have.property('result');
      expect(response.result).to.have.lengthOf(response.count);
      const actualSite = response.result.find((element) => element.name === site.name);
      expect(actualSite).to.be.a('object');
      expect(actualSite).to.containSubset(site);
      expect(actualSite).to.have.property('id');
    });
  });

  it('should find a specific site by id', async () => {
    const site = SiteFactory.build({companyID: company.id});
    await siteApi.create(site);
    let siteId = null;
    await siteApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      expect(response).to.have.property('result');
      siteId = response.result.find((element) => element.name === site.name).id;
    });
    delete site.userIDs;
    await siteApi.readById(siteId, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.containSubset(site);
    });
  });

});
