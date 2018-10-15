const faker = require('faker');
const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

const CentralServerService = require('./api/client/CentralServerService');
const Factory = require('../factories/Factory');
const Ocpp15 = require('./api/soap/ocpp15');

const centralServerService = new CentralServerService();
const ocpp15 = new Ocpp15();

class Bootstrap {

  constructor() {
  }

  async createMinimalContext() {
    const context = {};

    const companyToCreate = Factory.company.build();
    await centralServerService.company.create(companyToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await centralServerService.company.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.company = response;
      });
    });

    const userToCreate = Factory.user.build();
    await centralServerService.user.create(userToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await centralServerService.user.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.user = response;
      });
    });

    const siteToCreate = Factory.site.build({companyID: context.company.id, userIDs: [context.user.id]});
    await centralServerService.site.create(siteToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await centralServerService.site.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.site = response;
      });
    });

    context.chargePoint = Factory.chargepoint.build();
    context.chargeBoxIdentity = faker.random.alphaNumeric(12).toUpperCase();
    context.address = `${this.baseApi.url}/ChargeBox/Ocpp`;

    await ocpp15.executeBootNotification(context.chargeBoxIdentity, context.address, context.chargePoint, response => {
      expect(response.status).to.eql('Accepted');
      context.currentTime = response.currentTime;
      context.heartbeatInterval = response.heartbeatInterval;
    });

    const siteAreaToCreate = Factory.sitearea.build({siteID: context.site.id});
    siteAreaToCreate.chargeBoxIDs = [];
    siteAreaToCreate.chargeBoxIDs.push(context.chargeBoxIdentity);
    await centralServerService.siteArea.create(siteAreaToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await centralServerService.siteArea.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.siteArea = response;
      });
    });

    return context;
  }

}

module.exports = Bootstrap;