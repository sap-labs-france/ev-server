import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import _ from 'lodash';
import AppError from '../../../../../exception/AppError';
import ChargingStationStorage from '../../../../../storage/mongodb/ChargingStationStorage';
import SiteAreaStorage from '../../../../../storage/mongodb/SiteAreaStorage';
import Company from '../../../../../types/Company';
import { HTTPError } from '../../../../../types/HTTPError';
import { OCPIConnector } from '../../../../../types/ocpi/OCPIConnector';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIEvse } from '../../../../../types/ocpi/OCPIEvse';
import { OCPILocation } from '../../../../../types/ocpi/OCPILocation';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import { ServerAction } from '../../../../../types/Server';
import Site from '../../../../../types/Site';
import SiteArea from '../../../../../types/SiteArea';
import Tenant from '../../../../../types/Tenant';
import LoggingHelper from '../../../../../utils/LoggingHelper';
import Utils from '../../../../../utils/Utils';
import AbstractOCPIService from '../../../AbstractOCPIService';
import OCPIUtils from '../../../OCPIUtils';
import AbstractEndpoint from '../../AbstractEndpoint';


const MODULE_NAME = 'EMSPLocationsEndpoint';

export default class EMSPLocationsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'locations');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'PUT':
        return this.putLocationRequest(req, res, next, tenant, ocpiEndpoint);
      case 'PATCH':
        return this.patchLocationRequest(req, res, next, tenant, ocpiEndpoint);
    }
  }

  private async putLocationRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
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
        action: ServerAction.OCPI_PUT_LOCATION, module: MODULE_NAME, method: 'putLocationRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get Orgs
    const { company, site, siteArea } = await this.getOrganizationsFromLocationID(
      tenant, ocpiEndpoint, locationID, ServerAction.OCPI_PUT_LOCATION, false);
    // Update/Create Location
    if (locationID && !evseUID && !evseConnectorID) {
      await this.putLocation(tenant, locationID, req.body as OCPILocation, company, site, siteArea, countryCode, partyID);
    }
    // Update Evse
    if (locationID && evseUID && !evseConnectorID) {
      await this.putEvse(tenant, locationID, evseUID, req.body as OCPIEvse, company, site, siteArea);
    }
    // Update Connector
    if (locationID && evseUID && evseConnectorID) {
      await this.putEvseConnector(tenant, locationID, evseUID, evseConnectorID, req.body as OCPIConnector, company, site, siteArea);
    }
    return OCPIUtils.success();
  }

  private async patchLocationRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    urlSegment.shift();
    const countryCode = urlSegment.shift();
    const partyID = urlSegment.shift();
    const locationID = urlSegment.shift();
    const evseUID = urlSegment.shift();
    const evseConnectorID = urlSegment.shift();
    if (!countryCode || !partyID || !locationID) {
      throw new AppError({
        action: ServerAction.OCPI_PATCH_LOCATION, module: MODULE_NAME, method: 'patchLocationRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get the Orgs
    const { company, site, siteArea } = await this.getOrganizationsFromLocationID(
      tenant, ocpiEndpoint, locationID, ServerAction.OCPI_PATCH_LOCATION, true);
    // Update Location
    if (locationID && !evseUID && !evseConnectorID) {
      await this.patchLocation(tenant, locationID, req.body as OCPILocation, company, site, siteArea);
    }
    // Update Evse
    if (locationID && evseUID && !evseConnectorID) {
      await this.patchEvse(tenant, locationID, evseUID, req.body as OCPIEvse, company, site, siteArea);
    }
    // Update Connector
    if (locationID && evseUID && evseConnectorID) {
      await this.patchEvseConnector(tenant, locationID, evseUID, evseConnectorID, req.body as OCPIConnector, company, site, siteArea);
    }
    return OCPIUtils.success();
  }

  private async putLocation(tenant: Tenant, locationID: string, location: OCPILocation,
      company: Company, site: Site, siteArea: SiteArea, countryCode: string, partyID: string): Promise<void> {
    if (location.id !== locationID) {
      throw new AppError({
        action: ServerAction.OCPI_PUT_LOCATION, module: MODULE_NAME, method: 'putLocation',
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
    site = await OCPIUtils.processEMSPLocationSite(tenant, location, company, site, siteName);
    // Process Site Area
    siteArea = await OCPIUtils.processEMSPLocationSiteArea(tenant, location, site, siteArea);
    // Process Charging Station
    await OCPIUtils.processEMSPLocationChargingStations(tenant, location, site, siteArea, evses, ServerAction.OCPI_PUT_LOCATION);
  }

  private async putEvse(tenant: Tenant, locationID: string, evseUID: string, evse: OCPIEvse,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    if (evse.uid !== evseUID) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site?.id, siteAreaID: siteArea?.id,
        action: ServerAction.OCPI_PUT_LOCATION, module: MODULE_NAME, method: 'putEvse',
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
        action: ServerAction.OCPI_PUT_LOCATION, module: MODULE_NAME, method: 'putEvse',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area does not exists for Location ID'${locationID}' and EVSE ID '${evseUID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evse }
      });
    }
    // Process Charging Station
    await OCPIUtils.processEMSPLocationChargingStation(
      tenant, siteArea.ocpiData.location, site, siteArea, evse, ServerAction.OCPI_PUT_LOCATION);
  }

  private async putEvseConnector(tenant: Tenant, locationID: string, evseUID: string, evseConnectorID: string, evseConnector: OCPIConnector,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    if (evseConnector.id !== evseConnectorID) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        action: ServerAction.OCPI_PUT_LOCATION, module: MODULE_NAME, method: 'putEvseConnector',
        errorCode: StatusCodes.NOT_FOUND,
        message: `EVSE Connector ID '${evseConnectorID}' mismatch in URL for Location ID '${locationID}' and EVSE ID '${evseUID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evseConnectorID, evseConnector }
      });
    }
    // Get Evse
    const evse = await this.checkAndGetEvse(
      tenant, locationID, evseUID, company, site, siteArea, ServerAction.OCPI_PUT_LOCATION);
    // Check Evse Connectors
    if (Utils.isEmptyArray(evse.connectors)) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        action: ServerAction.OCPI_PUT_LOCATION, module: MODULE_NAME, method: 'putEvseConnector',
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
    await OCPIUtils.processEMSPLocationChargingStation(
      tenant, siteArea.ocpiData.location, site, siteArea, evse, ServerAction.OCPI_PUT_LOCATION);
  }

  private async patchLocation(tenant: Tenant, locationID: string, location: OCPILocation,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    // Check Location in Site Area
    if (!siteArea.ocpiData?.location) {
      throw new AppError({
        action: ServerAction.OCPI_PATCH_LOCATION, module: MODULE_NAME, method: 'patchLocation',
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
    await OCPIUtils.processEMSPLocationSite(tenant, patchedLocation, company, site);
    // Process Site Area
    await OCPIUtils.processEMSPLocationSiteArea(tenant, patchedLocation, site, siteArea);
  }

  private async patchEvse(tenant: Tenant, locationID: string, evseUID: string, evse: OCPIEvse,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    // Get Evse
    const foundEvse = await this.checkAndGetEvse(
      tenant, locationID, evseUID, company, site, siteArea, ServerAction.OCPI_PATCH_LOCATION);
    // Patch
    const patchedEvse = {
      ...foundEvse,
      ...evse,
    };
    // Process Charging Station
    await OCPIUtils.processEMSPLocationChargingStation(
      tenant, siteArea.ocpiData.location, site, siteArea, patchedEvse, ServerAction.OCPI_PATCH_LOCATION);
  }

  private async patchEvseConnector(tenant: Tenant, locationID: string, evseUID: string, evseConnectorID: string, evseConnector: OCPIConnector,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    // Get Evse
    const evse = await this.checkAndGetEvse(
      tenant, locationID, evseUID, company, site, siteArea, ServerAction.OCPI_PUT_LOCATION);
    // Check Evse Connectors
    if (Utils.isEmptyArray(evse.connectors)) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        action: ServerAction.OCPI_PATCH_LOCATION, module: MODULE_NAME, method: 'patchEvseConnector',
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
        action: ServerAction.OCPI_PATCH_LOCATION, module: MODULE_NAME, method: 'patchEvseConnector',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Charging Station has no EVSE Connector with ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evseConnectorID, evse }
      });
    }
    // Patch
    _.merge(foundEvseConnector, evseConnector);
    // Process Charging Station
    await OCPIUtils.processEMSPLocationChargingStation(
      tenant, siteArea.ocpiData.location, site, siteArea, evse, ServerAction.OCPI_PUT_LOCATION);
  }

  private async getOrganizationsFromLocationID(tenant: Tenant, ocpiEndpoint: OCPIEndpoint, locationID: string,
      action: ServerAction, orgMustExist: boolean): Promise<{ company: Company; site: Site; siteArea: SiteArea; }> {
    // Get Company
    const company = await OCPIUtils.checkAndGetEMSPCompany(tenant, ocpiEndpoint);
    if (orgMustExist && !company) {
      throw new AppError({
        action, module: MODULE_NAME, method: 'getOrganizationFromLocationID',
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
        action, module: MODULE_NAME, method: 'getOrganizationFromLocationID',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area does not exist for Location ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, company }
      });
    }
    if (orgMustExist && !siteArea?.ocpiData?.location?.id) {
      throw new AppError({
        action, module: MODULE_NAME, method: 'getOrganizationFromLocationID',
        errorCode: StatusCodes.NOT_FOUND,
        message: 'Site Area does not have an OCPI Location',
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, siteArea, company }
      });
    }
    if (orgMustExist && !siteArea.site) {
      throw new AppError({
        action, module: MODULE_NAME, method: 'getOrganizationFromLocationID',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area does not have a Site for Location ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, siteArea, company }
      });
    }
    return { company, siteArea, site: siteArea?.site };
  }

  private async checkAndGetEvse(tenant: Tenant, locationID: string, evseUID: string,
      company: Company, site: Site, siteArea: SiteArea, action: ServerAction): Promise<OCPIEvse> {
    // Site Area (Location) must exists
    if (!siteArea?.ocpiData?.location) {
      throw new AppError({
        chargingStationID: evseUID, companyID: company.id, siteID: site.id, siteAreaID: siteArea.id,
        action, module: MODULE_NAME, method: 'checkAndGetEvse',
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
        action, module: MODULE_NAME, method: 'checkAndGetEvse',
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
        action, module: MODULE_NAME, method: 'checkAndGetEvse',
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
        action, module: MODULE_NAME, method: 'checkAndGetEvse',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Charging Station has no EVSE with ID '${evseUID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, chargingStation, siteArea }
      });
    }
    return foundEvse;
  }
}
