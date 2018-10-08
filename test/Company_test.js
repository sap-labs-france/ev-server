const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const CompanyApi = require('./api/client/company')
const CompanyFactory = require('./factories/company')
const BaseApi = require('./api/client/utils/baseApi')
const AuthenticatedBaseApi = require('./api/client/utils/authenticatedBaseApi')
const config = require('./config');

describe('Company tests', function() {
  this.timeout(10000);
  const authenticatedBaseApi = new AuthenticatedBaseApi(config.get('admin.user'), config.get('admin.password'), new BaseApi(`${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`));
  let companyApi = null;

  before(async () => {
    companyApi = new CompanyApi(authenticatedBaseApi);
  });

  it('should create a new company', async () => {
    await companyApi.create(CompanyFactory.build(), (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
    });
  });

  it('should find a newly created company from list', async () => {
    const company = CompanyFactory.build();
    await companyApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
    });
    await companyApi.create(company);

    await companyApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');

      expect(response).to.have.property('result');
      const actualCompany = response.result.find((element) => element.name === company.name);
      expect(actualCompany).to.be.a('object');
      expect(actualCompany).to.containSubset(company);
      expect(actualCompany).to.have.property('id');
    });
  });

  it('should find a specific company by id', async () => {
    const company = CompanyFactory.build();
    await companyApi.create(company);
    let companyId = null;
    await companyApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      expect(response).to.have.property('result');
      companyId = response.result.find((element) => element.name === company.name).id;
    });

    await companyApi.readById(companyId, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.containSubset(company);
    });
  });

});
