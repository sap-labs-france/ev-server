const faker = require('faker');
const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

const CompanyApi = require('./client/company');
const UserApi = require('./client/user');
const SiteAreaApi = require('./client/siteArea');
const SiteApi = require('./client/site');
const ChargingStationApi = require('./client/chargingStation');

const CompanyFactory = require('../factories/company');
const UserFactory = require('../factories/user');
const SiteAreaFactory = require('../factories/siteArea');
const SiteFactory = require('../factories/site');
const ChargePointFactory = require('../factories/chargePoint');

class Bootstrap {

  constructor(baseApi, ocpp15) {
    this.baseApi = baseApi;
    this.companyApi = new CompanyApi(baseApi);
    this.userApi = new UserApi(baseApi);
    this.siteAreaApi = new SiteAreaApi(baseApi);
    this.siteApi = new SiteApi(baseApi);
    this.chargingStationApi = new ChargingStationApi(baseApi);
    this.ocpp15 = ocpp15;
  }

  async createMinimalContext() {
    const context = {};

    const companyToCreate = CompanyFactory.build();

    await this.companyApi.create(companyToCreate, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
    });
    await this.companyApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      context.company = response.result.find((element) => element.name === companyToCreate.name);
    });

    const userToCreate = UserFactory.build();
    await this.userApi.create(userToCreate, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
    });

    await this.userApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      context.user = response.result.find((element) => element.name === userToCreate.name);
    });

    const siteToCreate = SiteFactory.build({companyID: context.company.id, userIDs: [context.user.id]});
    await this.siteApi.create(siteToCreate, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
    });
    await this.siteApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      context.site = response.result.find((element) => element.name === siteToCreate.name);
    });

    context.chargePoint = ChargePointFactory.build();
    context.chargeBoxIdentity = faker.random.alphaNumeric(20).toUpperCase();

    context.address = `${this.baseApi.url}/ChargeBox/Ocpp`;

    await this.ocpp15.executeBootNotification(context.chargeBoxIdentity, context.address, context.chargePoint, response => {
      expect(response.status).to.eql('Accepted');
      context.currentTime = response.currentTime;
      context.heartbeatInterval = response.heartbeatInterval;
    });

    const siteAreaToCreate = SiteAreaFactory.build({siteID: context.site.id});
    siteAreaToCreate.chargeBoxIDs = [];
    siteAreaToCreate.chargeBoxIDs.push(context.chargeBoxIdentity);
    await this.siteAreaApi.create(siteAreaToCreate, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
    });
    await this.siteAreaApi.readAll({}, (message, response) => {
      expect(message.status).to.equal(200);
      expect(response).to.have.property('count');
      context.siteArea = response.result.find((element) => element.name === siteAreaToCreate.name);
    });

    return context;
  }

}

module.exports = Bootstrap;