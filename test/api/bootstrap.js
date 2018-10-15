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
    await this.companyApi.create(companyToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await this.companyApi.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.company = response;
      });
    });

    const userToCreate = UserFactory.build();
    await this.userApi.create(userToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await this.userApi.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.user = response;
      });
    });

    const siteToCreate = SiteFactory.build({companyID: context.company.id, userIDs: [context.user.id]});
    await this.siteApi.create(siteToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await this.siteApi.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.site = response;
      });
    });

    context.chargePoint = ChargePointFactory.build();
    context.chargeBoxIdentity = faker.random.alphaNumeric(12).toUpperCase();
    context.address = `${this.baseApi.url}/ChargeBox/Ocpp`;

    await this.ocpp15.executeBootNotification(context.chargeBoxIdentity, context.address, context.chargePoint, response => {
      expect(response.status).to.eql('Accepted');
      context.currentTime = response.currentTime;
      context.heartbeatInterval = response.heartbeatInterval;
    });

    const siteAreaToCreate = SiteAreaFactory.build({siteID: context.site.id});
    siteAreaToCreate.chargeBoxIDs = [];
    siteAreaToCreate.chargeBoxIDs.push(context.chargeBoxIdentity);
    await this.siteAreaApi.create(siteAreaToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await this.siteAreaApi.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.siteArea = response;
      });
    });

    return context;
  }

}

module.exports = Bootstrap;