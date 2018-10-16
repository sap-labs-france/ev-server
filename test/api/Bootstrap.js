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

    let response = await CentralServerService.company.create(companyToCreate);
    expect(response.status).to.equal(200);
    expect(response.data.status).to.eql('Success');

    response = await CentralServerService.company.readById(response.data.id);
    expect(response.status).to.equal(200);
    context.company = response.data;

    const userToCreate = Factory.user.build();
    response = await CentralServerService.user.create(userToCreate);
    expect(response.status).to.equal(200);
    expect(response.data.status).to.eql('Success');

    response = await CentralServerService.user.readById(response.data.id);
    expect(response.status).to.equal(200);
    context.user = response.data;

    const siteToCreate = Factory.site.build({companyID: context.company.id, userIDs: [context.user.id]});
    response = await CentralServerService.site.create(siteToCreate);
    expect(response.status).to.equal(200);
    expect(response.data.status).to.eql('Success');

    response = await CentralServerService.site.readById(response.data.id);
    expect(response.status).to.equal(200);
    context.site = response.data;

    context.chargePoint = Factory.chargePoint.build();
    context.chargeBoxIdentity = faker.random.alphaNumeric(12).toUpperCase();
    context.address = `${CentralServerService.url}/ChargeBox/Ocpp`;

    response = await this.ocpp15.executeBootNotification(context.chargeBoxIdentity, context.address, context.chargePoint);
    expect(response.data.status).to.eql('Accepted');
    context.currentTime = response.data.currentTime;
    context.heartbeatInterval = response.data.heartbeatInterval;

    const siteAreaToCreate = Factory.siteArea.build({siteID: context.site.id});
    siteAreaToCreate.chargeBoxIDs = [];
    siteAreaToCreate.chargeBoxIDs.push(context.chargeBoxIdentity);

    response = await CentralServerService.siteArea.create(siteAreaToCreate);
    expect(response.status).to.equal(200);
    expect(response.data.status).to.eql('Success');

    response = await CentralServerService.siteArea.readById(response.data.id);
    expect(response.status).to.equal(200);
    context.siteArea = response.data;

    return context;
  }

}

module.exports = Bootstrap;