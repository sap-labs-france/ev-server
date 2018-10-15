const faker = require('faker');
const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

class Bootstrap {

  constructor(ocpp15) {
    this.ocpp15 = ocpp15;
  }

  async createMinimalContext() {
    const context = {};

    const companyToCreate = Factory.company.build();
    await CentralServerService.company.create(companyToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await CentralServerService.company.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.company = response;
      });
    });

    const userToCreate = Factory.user.build();
    await CentralServerService.user.create(userToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await CentralServerService.user.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.user = response;
      });
    });

    const siteToCreate = Factory.site.build({companyID: context.company.id, userIDs: [context.user.id]});
    await CentralServerService.site.create(siteToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await CentralServerService.site.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.site = response;
      });
    });

    context.chargePoint = Factory.chargePoint.build();
    context.chargeBoxIdentity = faker.random.alphaNumeric(12).toUpperCase();
    context.address = `${CentralServerService.url}/ChargeBox/Ocpp`;

    await this.ocpp15.executeBootNotification(context.chargeBoxIdentity, context.address, context.chargePoint, response => {
      expect(response.status).to.eql('Accepted');
      context.currentTime = response.currentTime;
      context.heartbeatInterval = response.heartbeatInterval;
    });

    const siteAreaToCreate = Factory.siteArea.build({siteID: context.site.id});
    siteAreaToCreate.chargeBoxIDs = [];
    siteAreaToCreate.chargeBoxIDs.push(context.chargeBoxIdentity);
    await CentralServerService.siteArea.create(siteAreaToCreate, async (message, response) => {
      expect(message.status).to.equal(200);
      expect(response.status).to.eql('Success');
      await CentralServerService.siteArea.readById(response.id, (message, response) => {
        expect(message.status).to.equal(200);
        context.siteArea = response;
      });
    });

    return context;
  }

}

module.exports = Bootstrap;