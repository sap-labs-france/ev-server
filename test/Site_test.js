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

const authenticatedBaseApi = new AuthenticatedBaseApi(config.get('admin.username'), config.get('admin.password'), new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`));
let companyApi = new CompanyApi(authenticatedBaseApi);
let siteApi = new SiteApi(authenticatedBaseApi);


describe('Site tests', function() {
  this.timeout(10000);
  let company = null;
  beforeEach(async () => {
    company = CompanyFactory.build();
    await companyApi.create(company, (message, response) => {
      expect(message.status).to.equal(200);
      company.id = response.id;
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
    await siteApi.create(site, ((message, response) => {
      site.id = response.id;
    }));
    await siteApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');

      expect(response).to.have.property('result');
      const actualSite = response.result.find((element) => element.name === site.name);
      expect(actualSite).to.be.a('object');
      expect(actualSite).to.containSubset(site);
    });
  });

  it('should find a specific site by id', async () => {
    const site = SiteFactory.build({companyID: company.id});
    await siteApi.create(site, (message, response) => {
      expect(message.status).to.equal(200);
      site.id = response.id;
    });
    await siteApi.readById(site.id, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.containSubset(site);
    });
  });

});
