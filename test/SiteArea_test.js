const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CompanyApi = require('./api/client/company');
const SiteApi = require('./api/client/site');
const SiteAreaApi = require('./api/client/siteArea');
const CompanyFactory = require('./factories/company');
const SiteAreaFactory = require('./factories/siteArea');
const SiteFactory = require('./factories/site');
const BaseApi = require('./api/client/utils/baseApi');
const AuthenticatedBaseApi = require('./api/client/utils/authenticatedBaseApi');
const config = require('./config');

const authenticatedBaseApi = new AuthenticatedBaseApi(config.get('admin.username'), config.get('admin.password'), new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`));
let companyApi = new CompanyApi(authenticatedBaseApi);
let siteApi = new SiteApi(authenticatedBaseApi);
let siteAreaApi = new SiteAreaApi(authenticatedBaseApi);


describe('SiteArea tests', function() {
  this.timeout(10000);
  describe('green cases', function() {
    let site = null;
    let company = null;

    beforeEach(async function() {
      company = CompanyFactory.build();
      await companyApi.create(company, (message, response) => {
        expect(message.status).to.equal(200);
        company.id = response.id;
      });

      site = SiteFactory.build({companyID: company.id});
      await siteApi.create(site, (message, response) => {
        expect(message.status).to.equal(200);
        site.id = response.id;
      });

    });

    it('should create a new SiteAreaArea', async function() {
      await siteAreaApi.create(SiteAreaFactory.build({siteID: site.id}), (message, response) => {
        expect(message.status).to.equal(200);
        expect(response.status).to.eql('Success');
        expect(response).to.have.property('id');
        expect(response.id).to.match(/^[a-f0-9]+$/);
      });
    });

    it('should find a newly created siteArea from list', async function() {
      const siteArea = SiteAreaFactory.build({siteID: site.id});
      await siteAreaApi.create(siteArea, ((message, response) => {
        siteArea.id = response.id;
      }));
      await siteAreaApi.readAll({}, (message, response) => {
        expect(message.status).to.equal(200);
        expect(response).to.have.property('count');

        expect(response).to.have.property('result');
        const actualSiteArea = response.result.find((element) => element.name === siteArea.name);
        expect(actualSiteArea).to.be.a('object');
        expect(actualSiteArea).to.containSubset(siteArea);
      });
    });

    it('should find a specific siteArea by id', async function() {
      const siteArea = SiteAreaFactory.build({siteID: site.id});
      await siteAreaApi.create(siteArea, ((message, response) => {
        expect(message.status).to.equal(200);
        siteArea.id = response.id;
      }));
      await siteAreaApi.readById(siteArea.id, (message, response) => {
        expect(message.status).to.equal(200);
        expect(response).to.containSubset(siteArea);
      });
    });
  });
  describe('Error cases', function() {
    it('should not create a siteArea without a referenced site', async function() {
      const siteArea = SiteAreaFactory.build({siteID: null});
      await siteAreaApi.create(siteArea, (message, response) => {
        expect(message.status).to.equal(500);
      });
    });
  });
});
