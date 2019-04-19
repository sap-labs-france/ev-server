const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const faker = require('faker');
const { expect } = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);

const CentralServerService = require('./client/CentralServerService');
const Factory = require('../factories/Factory');
const TenantFactory = require('../factories/TenantFactory');

class OCPPBootstrap {
  constructor(ocpp) {
    this.ocpp = ocpp;
  }

  async createContext() {
    const context = {};
    try {
      // // Create
      // this.tenantNoOrg = await CentralServerService.createEntity(
      //   CentralServerService.tenantApi, TenantFactory.buildTenantCreate());

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
      
      // Generate ID
      const chargingStationID = faker.random.alphaNumeric(12);
      // Create Charger Object
      const chargingStation = Factory.chargingStation.build();
      // Simulate a Boot Notification
      let response = await this.ocpp.executeBootNotification(chargingStationID, chargingStation);
      // Check
      expect(response.data).to.not.be.null;
      expect(response.data.status).to.eql('Accepted');
      expect(response.data).to.have.property('currentTime');      
      // Check according the OCPP version
      if (this.ocpp.getVersion() === "1.6") {
        // OCPP 1.6
        expect(response.data).to.have.property('interval');      
      } else {
        // OCPP 1.2, 1.5
        expect(response.data).to.have.property('heartbeatInterval');      
      }

      // Send Status Notif for Connector A
      response = await this.ocpp.executeStatusNotification(chargingStationID, {
        connectorId: 1,
        status: 'Available',
        errorCode: 'NoError',
        timestamp: new Date().toISOString()
      });
      // Check
      expect(response).to.not.be.null;
      expect(response.data).to.eql({});
      // Send Status Notif for Connector B
      response = await this.ocpp.executeStatusNotification(chargingStationID, {
        connectorId: 2,
        status: 'Available',
        errorCode: 'NoError',
        timestamp: new Date().toISOString()
      });
      // Check
      expect(response).to.not.be.null;
      expect(response.data).to.eql({});

      // Create the Site Area 
      context.newSiteArea = await CentralServerService.createEntity(
        CentralServerService.siteAreaApi, Factory.siteArea.build({
          siteID: context.newSite.id,
          chargeBoxIDs: [chargingStationID]
        }));
      expect(context.newSiteArea).to.not.be.null;

      // Retrieve the latest Charger object with the Site Area ID 
      context.newChargingStation = chargingStation;
      context.newChargingStation.id = chargingStationID;
      context.newChargingStation.siteAreaID = context.newSiteArea.id;
      // Get the new Charger
      context.newChargingStation = await CentralServerService.getEntityById(
        CentralServerService.chargingStationApi, context.newChargingStation);
        
    } catch (error) {
      // Error: Clean up!
      this.destroyContext(context);
      throw error;
    }
    
    // Ok
    return context;
  }

  async destroyContext(context) {
    // if (this.tenantNoOrg) {
    //   // Check if the deleted entity cannot be retrieved with its id
    //   await CentralServerService.checkDeletedEntityById(
    //     CentralServerService.tenantApi, this.tenantNoOrg);
    // }    

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
    // Delete Charging Station?
    if (context.newChargingStation) {
      // Delete
      await CentralServerService.deleteEntity(
        CentralServerService.chargingStationApi, context.newChargingStation);
    }
  }

}

module.exports = OCPPBootstrap;