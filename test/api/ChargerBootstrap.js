const faker = require('faker');
const {
  expect
} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');

class ChargerBootstrap {

  constructor(ocpp) {
    this.ocpp = ocpp;
  }

  async destroyContext(context) {
    // Delete User?
    if (context.newUser) {
      // Delete
      await CentralServerService.deleteEntity(
        CentralServerService.userApi, context.newUser);
    }
    // Delete Site Area?
    if (context.newSiteArea) {
      // Delete
      await CentralServerService.deleteEntity(
        CentralServerService.siteAreaApi, context.newSiteArea);
    }
    // Delete Site?
    if (context.newSite) {
      // Delete
      await CentralServerService.deleteEntity(
        CentralServerService.siteApi, context.newSite);
    }
    // Delete Company?
    if (context.newCompany) {
      // Delete
      await CentralServerService.deleteEntity(
        CentralServerService.companyApi, context.newCompany);
    }
  }

  async createContext() {
    const context = {};

    // Create User
    context.newUser = await CentralServerService.createEntity(
      CentralServerService.userApi, Factory.user.build());
    expect(context.newUser).to.not.be.null;

    // Create Company
    context.newCompany = await CentralServerService.createEntity(
      CentralServerService.companyApi, Factory.company.build());
    expect(context.newCompany).to.not.be.null;

    // Create Site
    context.newSite = await CentralServerService.createEntity(
      CentralServerService.siteApi, Factory.site.build({
        companyID: context.newCompany.id,
        userIDs: [context.newUser.id]
      }));
    expect(context.newSite).to.not.be.null;

    // Create Charger
    context.chargingStation = Factory.chargingStation.build();
    context.publicURL = CentralServerService.url;
    // Simulate a Boot Notification
    response = await this.ocpp.executeBootNotification(
      context.chargingStation.chargeBoxIdentity,
      context.publicURL,
      context.chargingStation);
    expect(response.data.status).to.eql('Accepted');
    // Keep Response
    context.currentTime = response.data.currentTime;
    context.heartbeatInterval = response.data.heartbeatInterval;

    // Create the Site Area 
    context.newSiteArea = await CentralServerService.createEntity(
      CentralServerService.siteAreaApi, Factory.siteArea.build({
        siteID: context.newSite.id,
        chargeBoxIDs: [context.chargeBoxIdentity]
      }));
    expect(context.newSiteArea).to.not.be.null;
    
    // Ok
    return context;
  }

}

module.exports = ChargerBootstrap;