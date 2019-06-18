const path = require('path');
import TSGlobal from '../../src/types/GlobalType';
declare const global: TSGlobal;
global.appRoot = path.resolve(__dirname, '../../src');
import chai from 'chai';
import {expect} from 'chai';
import chaiSubset from 'chai-subset';
import faker from 'faker';
import CentralServerService from '../api/client/CentralServerService';
chai.use(chaiSubset);
import Factory from '../factories/Factory';

export default class OCPPBootstrap {
  public ocpp: any;
  public constructor(ocpp) {
    this.ocpp = ocpp;
  }

  public async createContext() {
    const context:any = {};
    try {
      // // Create
      // this.tenantNoOrg = await CentralServerService.DefaultInstance.createEntity(
      //   CentralServerService.DefaultInstance.tenantApi, TenantFactory.buildTenantCreate());

      // Create User
      context.newUser = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.userApi, Factory.user.build());
      expect(context.newUser).to.not.be.null;

      // Create Company
      context.newCompany = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.companyApi, Factory.company.build());
      expect(context.newCompany).to.not.be.null;

      // Create Site
      context.newSite = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.siteApi, Factory.site.build({
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
      context.newSiteArea = await CentralServerService.DefaultInstance.createEntity(
        CentralServerService.DefaultInstance.siteAreaApi, Factory.siteArea.build({
          siteID: context.newSite.id,
          chargeBoxIDs: [chargingStationID]
        }));
      expect(context.newSiteArea).to.not.be.null;

      // Retrieve the latest Charger object with the Site Area ID 
      context.newChargingStation = chargingStation;
      context.newChargingStation.id = chargingStationID;
      context.newChargingStation.siteAreaID = context.newSiteArea.id;
      // Get the new Charger
      context.newChargingStation = await CentralServerService.DefaultInstance.getEntityById(
        CentralServerService.DefaultInstance.chargingStationApi, context.newChargingStation);
        
    } catch (error) {
      // Error: Clean up!
      this.destroyContext(context);
      throw error;
    }
    
    // Ok
    return context;
  }

  public async destroyContext(context) {
    // if (this.tenantNoOrg) {
    //   // Check if the deleted entity cannot be retrieved with its id
    //   await CentralServerService.DefaultInstance.checkDeletedEntityById(
    //     CentralServerService.DefaultInstance.tenantApi, this.tenantNoOrg);
    // }    

    // Delete User?
    if (context.newUser) {
      // Delete
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.userApi, context.newUser);
    }
    // Delete Site Area?
    if (context.newSiteArea) {
      // Delete
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.siteAreaApi, context.newSiteArea);
    }
    // Delete Site?
    if (context.newSite) {
      // Delete
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.siteApi, context.newSite);
    }
    // Delete Company?
    if (context.newCompany) {
      // Delete
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.companyApi, context.newCompany);
    }
    // Delete Charging Station?
    if (context.newChargingStation) {
      // Delete
      await CentralServerService.DefaultInstance.deleteEntity(
        CentralServerService.DefaultInstance.chargingStationApi, context.newChargingStation);
    }
  }

}

// module.exports = OCPPBootstrap;