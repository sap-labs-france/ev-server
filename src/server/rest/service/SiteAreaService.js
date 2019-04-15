const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Constants = require('../../../utils/Constants');
const SiteAreaSecurity = require('./security/SiteAreaSecurity');
const Authorizations = require('../../../authorization/Authorizations');
const User = require('../../../entity/User');
const ChargingStation = require('../../../entity/ChargingStation');
const Site = require('../../../entity/Site');
const SiteArea = require('../../../entity/SiteArea');

class SiteAreaService {
  static async handleCreateSiteArea(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canCreateSite(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_CREATE,
          Constants.ENTITY_SITE_AREA,
          null,
          560, 'SiteAreaService', 'handleCreateSiteArea',
          req.user);
      }
      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreaCreateRequest( req.body, req.user );
      // Check Mandatory fields
      SiteArea.checkIfSiteAreaValid(filteredRequest, req);
      // Check Site
      const site = await Site.getSite(req.user.tenantID, filteredRequest.siteID);
      // Found?
      if (!site) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site ID '${filteredRequest.siteID}' does not exist`, 550,
          'SiteAreaService', 'handleCreateSiteArea', req.user);
      }
      // Create site
      const siteArea = new SiteArea(req.user.tenantID, filteredRequest);
      // Update timestamp
      siteArea.setCreatedBy(new User(req.user.tenantID, {'id': req.user.id}));
      siteArea.setCreatedOn(new Date());
      // Save
      const newSiteArea = await siteArea.save();
      // Save Site's Image
      newSiteArea.setImage(siteArea.getImage());
      // Save
      await newSiteArea.saveImage();
      // Get the assigned Charge Boxes
      for (const chargeBoxID of filteredRequest.chargeBoxIDs) {
        // Get the charging stations
        const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, chargeBoxID);
        if (chargingStation) {
          // Update timestamp
          chargingStation.setLastChangedBy(new User(req.user.tenantID, {'id': req.user.id}));
          chargingStation.setLastChangedOn(new Date());
          // Set
          chargingStation.setSiteArea(newSiteArea);
          // Save
          chargingStation.saveChargingStationSiteArea();
        }
      }
      // Ok
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteAreaService', method: 'handleCreateSiteArea',
        message: `Site Area '${newSiteArea.getName()}' has been created successfully`,
        action: action, detailedMessages: newSiteArea});
      // Ok
      res.json(Object.assign({ id: newSiteArea.getID() }, Constants.REST_RESPONSE_SUCCESS));
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetSiteAreas(action, req, res, next) {
    try {
      // Check auth
      if (!Authorizations.canListSiteAreas(req.user)) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_LIST,
          Constants.ENTITY_SITE_AREAS,
          null,
          560, 'SiteAreaService', 'handleGetSiteAreas',
          req.user);
      }
      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreasRequest(req.query, req.user);
      // Get the sites
      const siteAreas = await SiteArea.getSiteAreas(req.user.tenantID,
        { 'search': filteredRequest.Search,
          'withSite': filteredRequest.WithSite,
          'withChargeBoxes': filteredRequest.WithChargeBoxes,
          'withAvailableChargers': filteredRequest.WithAvailableChargers,
          'siteID': filteredRequest.SiteID },
        filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
      // Set
      siteAreas.result = siteAreas.result.map((siteArea) => siteArea.getModel());
      // Filter
      siteAreas.result = SiteAreaSecurity.filterSiteAreasResponse(
        siteAreas.result, req.user);
      // Return
      res.json(siteAreas);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleDeleteSiteArea(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreaDeleteRequest(req.query, req.user);
      // Check Mandatory fields
      if(!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site Area's ID must be provided`, 500,
          'SiteAreaService', 'handleDeleteSiteArea', req.user);
      }
      // Get
      const siteArea = await SiteArea.getSiteArea(req.user.tenantID, filteredRequest.ID);
      // Found?
      if (!siteArea) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Site Area with ID '${filteredRequest.ID}' does not exist`, 550,
          'SiteAreaService', 'handleDeleteSiteArea', req.user);
      }
      // Check auth
      if (!Authorizations.canDeleteSiteArea(req.user, { 'id': siteArea.getID() })) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_DELETE,
          Constants.ENTITY_SITE_AREA,
          siteArea.getID(),
          560,
          'SiteAreaService', 'handleDeleteSiteArea',
          req.user);
      }
      // Delete
      await siteArea.delete();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteAreaService', method: 'handleDeleteSiteArea',
        message: `Site Area '${siteArea.getName()}' has been deleted successfully`,
        action: action, detailedMessages: siteArea});
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetSiteArea(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreaRequest(req.query, req.user);
      // Charge Box is mandatory
      if(!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site Area's ID must be provided`, 500,
          'SiteAreaService', 'handleGetSiteArea', req.user);
      }
      // Get it
      const siteArea = await SiteArea.getSiteArea(req.user.tenantID,
        filteredRequest.ID, filteredRequest.WithChargeBoxes, filteredRequest.WithSite);
      // Found?
      if (!siteArea) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `Site Area with ID '${filteredRequest.ID}' does not exist`, 550,
          'SiteAreaService', 'handleGetSiteArea', req.user);
      }
      // Check auth
      if (!Authorizations.canReadSiteArea(req.user, siteArea.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_SITE_AREA,
          siteArea.getID(),
          560,
          'SiteAreaService', 'handleGetSiteAreaImage',
          req.user);
      }
      // Return
      res.json(
        // Filter
        SiteAreaSecurity.filterSiteAreaResponse(
          siteArea.getModel(), req.user)
      );
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleGetSiteAreaImage(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreaRequest(req.query, req.user);
      // Charge Box is mandatory
      if(!filteredRequest.ID) {
        // Not Found!
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site Area's ID must be provided`, 500,
          'SiteAreaService', 'handleGetSiteAreaImage', req.user);
      }
      // Get it
      const siteArea = await SiteArea.getSiteArea(req.user.tenantID, filteredRequest.ID);
      if (!siteArea) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site Area with ID '${filteredRequest.ID}' does not exist anymore`, 550,
          'SiteAreaService', 'handleGetSiteAreaImage', req.user);
      }
      // Check auth
      if (!Authorizations.canReadSiteArea(req.user, siteArea.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_READ,
          Constants.ENTITY_SITE_AREA,
          siteArea.getID(),
          560, 'SiteAreaService', 'handleGetSiteAreaImage',
          req.user);
      }
      // Get the image
      const siteAreaImage = await SiteArea.getSiteAreaImage(req.user.tenantID, filteredRequest.ID);
      // Return
      res.json(siteAreaImage);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }

  static async handleUpdateSiteArea(action, req, res, next) {
    try {
      // Filter
      const filteredRequest = SiteAreaSecurity.filterSiteAreaUpdateRequest( req.body, req.user );
      // Check
      const siteArea = await SiteArea.getSiteArea(req.user.tenantID, filteredRequest.id);
      if (!siteArea) {
        throw new AppError(
          Constants.CENTRAL_SERVER,
          `The Site Area with ID '${filteredRequest.id}' does not exist anymore`, 550,
          'SiteAreaService', 'handleUpdateSiteArea', req.user);
      }
      // Check Mandatory fields
      SiteArea.checkIfSiteAreaValid(filteredRequest, req);
      // Check auth
      if (!Authorizations.canUpdateSiteArea(req.user, siteArea.getModel())) {
        // Not Authorized!
        throw new AppAuthError(
          Constants.ACTION_UPDATE,
          Constants.ENTITY_SITE_AREA,
          siteArea.getID(),
          560, 'SiteAreaService', 'handleUpdateSiteArea',
          req.user);
      }

      // TODO: logic to be changed when old dashboard is removed - kept for compatibility reason.
      if (filteredRequest.chargeBoxIDs && filteredRequest.chargeBoxIDs.length > 0) {
        // Get Charging Stations
        const chargingStations = await siteArea.getChargingStations();
        // Clear Site Area from Existing Charging Station
        for (const chargingStation of chargingStations) {
          // Update timestamp
          chargingStation.setLastChangedBy(new User(req.user.tenantID, {'id': req.user.id}));
          chargingStation.setLastChangedOn(new Date());
          // Set
          chargingStation.setSiteArea(null);
          // Save
          await chargingStation.saveChargingStationSiteArea();
        }
        // Assign Site Area to Charging Stations
        for (const chargeBoxID of filteredRequest.chargeBoxIDs) {
          // Get the charging stations
          const chargingStation = await ChargingStation.getChargingStation(req.user.tenantID, chargeBoxID);
          if (chargingStation) {
            // Update timestamp
            chargingStation.setLastChangedBy(new User(req.user.tenantID, {'id': req.user.id}));
            chargingStation.setLastChangedOn(new Date());
            // Set
            chargingStation.setSiteArea(siteArea);
            // Save
            await chargingStation.saveChargingStationSiteArea();
          }
        }
      }
      // Update
      Database.updateSiteArea(filteredRequest, siteArea.getModel());
      // Update timestamp
      siteArea.setLastChangedBy(new User(req.user.tenantID, {'id': req.user.id}));
      siteArea.setLastChangedOn(new Date());
      // Update Site Area
      const updatedSiteArea = await siteArea.save();
      // Update Site Area's Image
      await siteArea.saveImage();
      // Log
      Logging.logSecurityInfo({
        tenantID: req.user.tenantID,
        user: req.user, module: 'SiteAreaService', method: 'handleUpdateSiteArea',
        message: `Site Area '${updatedSiteArea.getName()}' has been updated successfully`,
        action: action, detailedMessages: updatedSiteArea});
      // Ok
      res.json(Constants.REST_RESPONSE_SUCCESS);
      next();
    } catch (error) {
      // Log
      Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
    }
  }
}

module.exports = SiteAreaService;
