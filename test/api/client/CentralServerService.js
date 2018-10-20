const {expect} = require('chai');
const BaseApi = require('./utils/BaseApi');
const AuthenticatedBaseApi = require('./utils/AuthenticatedBaseApi');
const config = require('../../config');
const Constants = require('./utils/Constants');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const CompanyApi = require('./CompanyApi');
const SiteApi = require('./SiteApi');
// const SiteAreaApi = require('./SiteAreaApi');
// const UserApi = require('./UserApi');
// const ChargingStationApi = require('./ChargingStationApi');
// const TenantApi = require('./TenantApi');
// const TransactionApi = require('./TransactionApi');

// Set
chai.use(chaiSubset);
class CentralServerService {

  constructor() {
    const baseURL = `${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`;
    // Create the Base API
    const baseApi = new BaseApi(baseURL);
    // Create the Authenticated API
    const authenticatedApi = new AuthenticatedBaseApi(baseURL, config.get('admin.username'), config.get('admin.password'));
    // Create the Company
    this.company = new CompanyApi(authenticatedApi);
    this.site = new SiteApi(authenticatedApi);
    // this.siteArea = new SiteAreaApi(authenticatedApi);
    // this.user = new UserApi(authenticatedApi);
    // this.chargingStation = new ChargingStationApi(authenticatedApi);
    // this.transaction = new TransactionApi(authenticatedApi);
    // this.tenant = new TenantApi(authenticatedApi);
    // this.tenantNoAuth = new TenantApi(baseApi);
    // this.url = authenticatedApi.url;
  }

  async createEntity(entityApi, entity) {
    // Create it in the backend
    let response = await entityApi.create(entity);
    // Check
    expect(response.status).to.equal(200);
    expect(response.data.status).to.eql('Success');
    expect(response.data).to.have.property('id');
    expect(response.data.id).to.match(/^[a-f0-9]+$/);
    // Set the id
    entity.id = response.data.id;
    return entity;
  }

  async checkCreatedEntityById(entityApi, entity) {
    // Check first if created
    expect(entity).to.not.be.null;
    // Retrieve it from the backend
    let response = await entityApi.readById(entity.id);
    // Check if ok
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(entity.id);
    expect(response.data).to.deep.include(entity);
    // Return the entity
    return response.data;
  }

  async checkCreatedEntityInList(entityApi, entity) {
    // Check first if created
    expect(entity).to.not.be.null;
    // Retrieve from the backend
    let response = await entityApi.readAll({}, { limit: Constants.UNLIMITED, skip: 0 });
    // Check
    expect(response.status).to.equal(200);
    // Contains props
    expect(response.data).to.have.property('count');
    expect(response.data).to.have.property('result');
    // All record retrieved
    expect(response.data.count).to.eql(response.data.result.length);
    // Check created company
    expect(response.data.result).to.containSubset([entity]);  
  }

  async deleteEntity(entityApi, entity) {
    // Check first if created
    expect(entity).to.not.be.null;
    // Delete it in the backend
    let response = await entityApi.delete(entity.id);
    // Check
    expect(response.status).to.equal(200);
    expect(response.data.status).to.eql('Success');
  }

  async checkDeletedEntityById(entityApi, entity) {
    // Check first if created
    expect(entity).to.not.be.null;
    // Create it in the backend
    let response = await entityApi.readById(entity.id);
    // Check if not found
    expect(response.status).to.equal(550);
  }
}

module.exports = new CentralServerService();