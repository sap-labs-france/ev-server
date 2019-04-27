const {expect} = require('chai');
const BaseApi = require('./utils/BaseApi');
const AuthenticatedBaseApi = require('./utils/AuthenticatedBaseApi');
const config = require('../../config');
const Constants = require('./utils/Constants');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const CompanyApi = require('./CompanyApi');
const SiteApi = require('./SiteApi');
const SiteAreaApi = require('./SiteAreaApi');
const UserApi = require('./UserApi');
const AuthenticationApi = require('./AuthenticationApi');
const TenantApi = require('./TenantApi');
const ChargingStationApi = require('./ChargingStationApi');
const TransactionApi = require('./TransactionApi');
const MailApi = require('./MailApi');
const SettingApi = require('./SettingApi');
const OCPIEndpointApi = require('./OCPIEndpointApi');

// Set
chai.use(chaiSubset);

class CentralServerService {

  constructor() {
    this.baseURL = `${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`;
    // Create the Base API
    this.baseApi = new BaseApi(this.baseURL);
    // Create the Authenticated API
    this.authenticatedApi = new AuthenticatedBaseApi(this.baseURL, config.get('admin.username'), config.get('admin.password'), config.get('admin.tenant'));
    this.authenticatedSuperAdminApi = new AuthenticatedBaseApi(this.baseURL, config.get('superadmin.username'), config.get('superadmin.password'), "");
    // Create the Company
    this.companyApi = new CompanyApi(this.authenticatedApi);
    this.siteApi = new SiteApi(this.authenticatedApi);
    this.siteAreaApi = new SiteAreaApi(this.authenticatedApi);
    this.userApi = new UserApi(this.authenticatedApi);
    this.authenticationApi = new AuthenticationApi(this.baseApi);
    this.tenantApi = new TenantApi(this.authenticatedSuperAdminApi, this.baseApi);
    this.chargingStationApi = new ChargingStationApi(this.authenticatedApi, this.baseApi);
    this.transactionApi = new TransactionApi(this.authenticatedApi);
    this.settingApi = new SettingApi(this.authenticatedApi);
    this.ocpiendpointApi = new OCPIEndpointApi(this.authenticatedApi);
    this.mailApi = new MailApi(new BaseApi(`http://${config.get('mailServer.host')}:${config.get('mailServer.port')}`));
  }

  async updatePriceSetting(priceKWH, priceUnit) {
    const settings = await this.settingApi.readAll();
    let newSetting = false;
    let setting = settings.data.result.find(s => s.identifier == 'pricing');
    if (!setting) {
      setting = {};
      setting.identifier = "pricing";
      newSetting = true;
    }
    setting.content = {
      simple: {
        price: priceKWH,
        currency: priceUnit
      }
    };
    if (newSetting) {
      return this.settingApi.create(setting);
    } else {
      return this.settingApi.update(setting);
    }
  }

  async createEntity(entityApi, entity, performCheck = true) {
    // Create
    let response = await entityApi.create(entity);
    // Check
    if (performCheck) {
      expect(response.status).to.equal(200);
      expect(response.data.status).to.eql('Success');
      expect(response.data).to.have.property('id');
      expect(response.data.id).to.match(/^[a-f0-9]+$/);
      // Set the id
      entity.id = response.data.id;
      return entity;
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  async getEntityById(entityApi, entity, performCheck = true) {
    // Check first if created
    expect(entity).to.not.be.null;
    // Retrieve it from the backend
    let response = await entityApi.readById(entity.id);
    // Check
    if (performCheck) {
      // Check if ok
      expect(response.status).to.equal(200);
      expect(response.data.id).is.eql(entity.id);
      expect(response.data).to.deep.include(entity);
      // Return the entity
      return response.data;
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  async checkEntityInList(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Retrieve from the backend
    let response = await entityApi.readAll({}, {limit: Constants.UNLIMITED, skip: 0});
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(200);
      // Contains props
      expect(response.data).to.have.property('count');
      expect(response.data).to.have.property('result');
      // All record retrieved
      expect(response.data.count).to.eql(response.data.result.length);
      // Check created company
      expect(response.data.result).to.containSubset([entity]);
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  async checkEntityInListWithParams(entityApi, entity, params = {}, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Retrieve from the backend
    let response = await entityApi.readAll(params, {limit: Constants.UNLIMITED, skip: 0});
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(200);
      // Contains props
      expect(response.data).to.have.property('count');
      expect(response.data).to.have.property('result');
      // All record retrieved
      expect(response.data.count).to.eql(response.data.result.length);
      // Check created company
      expect(response.data.result).to.containSubset([entity]);
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  async deleteEntity(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Delete it in the backend
    let response = await entityApi.delete(entity.id);
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(200);
      expect(response.data.status).to.eql('Success');
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  async updateEntity(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Delete it in the backend
    let response = await entityApi.update(entity);
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(200);
      expect(response.data.status).to.eql('Success');
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  async checkDeletedEntityById(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Create it in the backend
    let response = await entityApi.readById(entity.id);
    // Check
    if (performCheck) {
      // Check if not found
      expect(response.status).to.equal(550);
    } else {
      // Let the caller to handle response
      return response;
    }
  }
}

module.exports = new CentralServerService();