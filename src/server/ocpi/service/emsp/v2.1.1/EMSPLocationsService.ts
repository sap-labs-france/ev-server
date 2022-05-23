import { NextFunction, Request, Response } from 'express';

import AppError from '../../../../../exception/AppError';
import ChargingStationStorage from '../../../../../storage/mongodb/ChargingStationStorage';
import Company from '../../../../../types/Company';
import { HTTPError } from '../../../../../types/HTTPError';
import LoggingHelper from '../../../../../utils/LoggingHelper';
import { OCPIConnector } from '../../../../../types/ocpi/OCPIConnector';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIEvse } from '../../../../../types/ocpi/OCPIEvse';
import { OCPILocation } from '../../../../../types/ocpi/OCPILocation';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import { ServerAction } from '../../../../../types/Server';
import Site from '../../../../../types/Site';
import SiteArea from '../../../../../types/SiteArea';
import SiteAreaStorage from '../../../../../storage/mongodb/SiteAreaStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../../types/Tenant';
import Utils from '../../../../../utils/Utils';
import _ from 'lodash';

const MODULE_NAME = 'EMSPLocationsService';

export default class EMSPLocationsService {
  public static async handlePutLocation(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant, ocpiEndpoint } = req;
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyID = urlSegment.shift();
    const locationID = urlSegment.shift();
    const evseUID = urlSegment.shift();
    const evseConnectorID = urlSegment.shift();
    if (!countryCode || !partyID || !locationID) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePutLocation', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get Orgs
    const { company, site, siteArea } = await EMSPLocationsService.getOrganizationsFromLocationID(
      action, tenant, ocpiEndpoint, locationID, false);
    // Update/Create Location
    if (locationID && !evseUID && !evseConnectorID) {
      await EMSPLocationsService.putLocation(
        action, tenant, locationID, req.body as OCPILocation, company, site, siteArea, countryCode, partyID);
    }
    // Update Evse
    if (locationID && evseUID && !evseConnectorID) {
      await EMSPLocationsService.putEvse(
        action, tenant, locationID, evseUID, req.body as OCPIEvse, company, site, siteArea);
    }
    // Update Connector
    if (locationID && evseUID && evseConnectorID) {
      await EMSPLocationsService.putEvseConnector(
        action, tenant, locationID, evseUID, evseConnectorID, req.body as OCPIConnector, company, site, siteArea);
    }
    res.json(OCPIUtils.success());
    next();
  }

  public static async handlePatchLocation(action: ServerAction, req: Request, res: Response, next: NextFunction): Promise<void> {
    const { tenant, ocpiEndpoint } = req;
    const urlSegment = req.path.substring(1).split('/');
    urlSegment.shift();
    const countryCode = urlSegment.shift();
    const partyID = urlSegment.shift();
    const locationID = urlSegment.shift();
    const evseUID = urlSegment.shift();
    const evseConnectorID = urlSegment.shift();
    if (!countryCode || !partyID || !locationID) {
      throw new AppError({
        module: MODULE_NAME, method: 'handlePatchLocation', action,
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get the Orgs
    const { company, site, siteArea } = await EMSPLocationsService.getOrganizationsFromLocationID(
      action, tenant, ocpiEndpoint, locationID, true);
    // Update Location
    if (locationID && !evseUID && !evseConnectorID) {
      await EMSPLocationsService.patchLocation(
        action, tenant, locationID, req.body as OCPILocation, company, site, siteArea);
    }
    // Update Evse
    if (locationID && evseUID && !evseConnectorID) {
      await EMSPLocationsService.patchEvse(
        action, tenant, locationID, evseUID, req.body as OCPIEvse, company, site, siteArea);
    }
    // Update Connector
    if (locationID && evseUID && evseConnectorID) {
      await EMSPLocationsService.patchEvseConnector(
        action, tenant, locationID, evseUID, evseConnectorID, req.body as OCPIConnector, company, site, siteArea);
    }
    res.json(OCPIUtils.success());
    next();
  }

  private static async putLocation(action: ServerAction, tenant: Tenant, locationID: string, location: OCPILocation,
      company: Company, site: Site, siteArea: SiteArea, countryCode: string, partyID: string): Promise<void> {
    if (location.id !== locationID) {
      throw new AppError({
        module: MODULE_NAME, method: 'putLocation', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Location ID '${locationID}' mismatch in URL`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, location }
      });
    }
    // Keep EVSEs
    const evses = location.evses;
    delete location.evses;
    // Process Site
    const siteName = OCPIUtils.buildOperatorName(countryCode, partyID);
    site = await OCPIUtils.updateCreateSiteWithEmspLocation(tenant, location, company, site, siteName);
    // Process Site Area
    siteArea = await OCPIUtils.updateCreateSiteAreaWithEmspLocation(tenant, location, site, siteArea);
    // Process Charging Station
    await OCPIUtils.updateCreateChargingStationsWithEmspLocation(tenant, location, site, siteArea, evses, ServerAction.OCPI_EMSP_UPDATE_LOCATION);
  }

  private static async putEvse(action: ServerAction, tenant: Tenant, locationID: string, evseUID: string, evse: OCPIEvse,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    if (evse.uid !== evseUID) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site?.id, siteAreaID: siteArea?.id,
        module: MODULE_NAME, method: 'putEvse', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `EVSE ID '${evseUID}' mismatch in URL for Location ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evse }
      });
    }
    // Site Area (Location) must exists
    if (!siteArea?.ocpiData?.location) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site?.id, siteAreaID: siteArea?.id,
        module: MODULE_NAME, method: 'putEvse', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area does not exists for Location ID'${locationID}' and EVSE ID '${evseUID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evse }
      });
    }
    // Process Charging Station
    await OCPIUtils.updateCreateChargingStationWithEmspLocation(
      tenant, siteArea.ocpiData.location, site, siteArea, evse, ServerAction.OCPI_EMSP_UPDATE_LOCATION);
  }

  private static async putEvseConnector(action: ServerAction, tenant: Tenant, locationID: string, evseUID: string, evseConnectorID: string, evseConnector: OCPIConnector,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    if (evseConnector.id !== evseConnectorID) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        module: MODULE_NAME, method: 'putEvseConnector', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `EVSE Connector ID '${evseConnectorID}' mismatch in URL for Location ID '${locationID}' and EVSE ID '${evseUID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evseConnectorID, evseConnector }
      });
    }
    // Get Evse
    const evse = await EMSPLocationsService.checkAndGetEvse(
      action, tenant, locationID, evseUID, company, site, siteArea);
    // Check Evse Connectors
    if (Utils.isEmptyArray(evse.connectors)) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        module: MODULE_NAME, method: 'putEvseConnector', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: 'Charging Station does not have an OCPI EVSE Connector',
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evseConnectorID, evse }
      });
    }
    // Remove the Connector
    evse.connectors = evse.connectors.filter(
      (connector) => connector.id !== evseConnectorID);
    // Put the new one
    evse.connectors.push(evseConnector);
    // Process Charging Station
    await OCPIUtils.updateCreateChargingStationWithEmspLocation(
      tenant, siteArea.ocpiData.location, site, siteArea, evse, ServerAction.OCPI_EMSP_UPDATE_LOCATION);
  }

  private static async patchLocation(action: ServerAction, tenant: Tenant, locationID: string, location: OCPILocation,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    // Check Location in Site Area
    if (!siteArea.ocpiData?.location) {
      throw new AppError({
        module: MODULE_NAME, method: 'patchLocation', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: 'Site Area does not have an OCPI Location',
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, location, siteArea }
      });
    }
    // Patch
    const patchedLocation = {
      ...siteArea.ocpiData.location,
      ...location,
    };
    // Process Site
    await OCPIUtils.updateCreateSiteWithEmspLocation(tenant, patchedLocation, company, site);
    // Process Site Area
    await OCPIUtils.updateCreateSiteAreaWithEmspLocation(tenant, patchedLocation, site, siteArea);
  }

  private static async patchEvse(action: ServerAction, tenant: Tenant, locationID: string, evseUID: string, evse: OCPIEvse,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    // Get Evse
    const foundEvse = await EMSPLocationsService.checkAndGetEvse(
      action, tenant, locationID, evseUID, company, site, siteArea);
    // Patch
    const patchedEvse = {
      ...foundEvse,
      ...evse,
    };
    // Process Charging Station
    await OCPIUtils.updateCreateChargingStationWithEmspLocation(
      tenant, siteArea.ocpiData.location, site, siteArea, patchedEvse, ServerAction.OCPI_EMSP_UPDATE_LOCATION);
  }

  private static async patchEvseConnector(action: ServerAction, tenant: Tenant, locationID: string, evseUID: string, evseConnectorID: string, evseConnector: OCPIConnector,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    // Get Evse
    const evse = await EMSPLocationsService.checkAndGetEvse(
      action, tenant, locationID, evseUID, company, site, siteArea);
    // Check Evse Connectors
    if (Utils.isEmptyArray(evse.connectors)) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        module: MODULE_NAME, method: 'patchEvseConnector', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: 'Charging Station does not have an OCPI EVSE Connector',
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evseConnectorID, evse }
      });
    }
    // Get the Connector
    const foundEvseConnector = evse.connectors.find(
      (connector) => connector.id === evseConnectorID);
    if (!foundEvseConnector) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        module: MODULE_NAME, method: 'patchEvseConnector', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Charging Station has no EVSE Connector with ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evseConnectorID, evse }
      });
    }
    // Patch
    _.merge(foundEvseConnector, evseConnector);
    // Process Charging Station
    await OCPIUtils.updateCreateChargingStationWithEmspLocation(
      tenant, siteArea.ocpiData.location, site, siteArea, evse, ServerAction.OCPI_EMSP_UPDATE_LOCATION);
  }

  private static async getOrganizationsFromLocationID(action: ServerAction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint, locationID: string,
      orgMustExist: boolean): Promise<{ company: Company; site: Site; siteArea: SiteArea; }> {
    // Get Company
    const company = await OCPIUtils.checkAndGetEmspCompany(tenant, ocpiEndpoint);
    if (orgMustExist && !company) {
      throw new AppError({
        module: MODULE_NAME, method: 'getOrganizationsFromLocationID', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Company does not exist for endpoint '${ocpiEndpoint.name}' (ID '${ocpiEndpoint.id}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, ocpiEndpoint }
      });
    }
    // Get Site Area
    const siteArea = await SiteAreaStorage.getSiteAreaByOcpiLocationUid(tenant, locationID);
    if (orgMustExist && !siteArea) {
      throw new AppError({
        module: MODULE_NAME, method: 'getOrganizationsFromLocationID', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area does not exist for Location ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, company }
      });
    }
    if (orgMustExist && !siteArea?.ocpiData?.location?.id) {
      throw new AppError({
        module: MODULE_NAME, method: 'getOrganizationsFromLocationID', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: 'Site Area does not have an OCPI Location',
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, siteArea, company }
      });
    }
    if (orgMustExist && !siteArea.site) {
      throw new AppError({
        module: MODULE_NAME, method: 'getOrganizationsFromLocationID', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area does not have a Site for Location ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, siteArea, company }
      });
    }
    return { company, siteArea, site: siteArea?.site };
  }

  private static async checkAndGetEvse(action: ServerAction, tenant: Tenant, locationID: string, evseUID: string,
      company: Company, site: Site, siteArea: SiteArea): Promise<OCPIEvse> {
    // Site Area (Location) must exists
    if (!siteArea?.ocpiData?.location) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        module: MODULE_NAME, method: 'checkAndGetEvse', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area with Location ID'${locationID}' does not exists`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, siteArea }
      });
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationEvseUid(
      tenant, locationID, evseUID);
    if (!chargingStation) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        module: MODULE_NAME, method: 'checkAndGetEvse', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Charging Station with EVSE ID '${evseUID}' and Location ID '${locationID}' does not exist`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, siteArea }
      });
    }
    // Check Evse in Charging Station
    if (Utils.isEmptyArray(chargingStation.ocpiData?.evses)) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'checkAndGetEvse', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: 'Charging Station does not have an OCPI EVSE',
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, chargingStation, siteArea }
      });
    }
    // Get the EVSE
    const foundEvse = chargingStation.ocpiData.evses.find(
      (chargingStationEvse) => chargingStationEvse.uid === evseUID);
    if (!foundEvse) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        module: MODULE_NAME, method: 'checkAndGetEvse', action,
        errorCode: StatusCodes.NOT_FOUND,
        message: `Charging Station has no EVSE with ID '${evseUID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, chargingStation, siteArea }
      });
    }
    return foundEvse;
  }
}
