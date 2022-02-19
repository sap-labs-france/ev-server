import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import AppError from '../../../../../exception/AppError';
import ChargingStationStorage from '../../../../../storage/mongodb/ChargingStationStorage';
import Company from '../../../../../types/Company';
import { HTTPError } from '../../../../../types/HTTPError';
import LoggingHelper from '../../../../../utils/LoggingHelper';
import { OCPIConnector } from '../../../../../types/ocpi/OCPIConnector';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPIEvse } from '../../../../../types/ocpi/OCPIEvse';
import { OCPILocation } from '../../../../../types/ocpi/OCPILocation';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import { ServerAction } from '../../../../../types/Server';
import Site from '../../../../../types/Site';
import SiteArea from '../../../../../types/SiteArea';
import SiteAreaStorage from '../../../../../storage/mongodb/SiteAreaStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../../types/Tenant';

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
    const connectorID = urlSegment.shift();
    if (!countryCode || !partyID || !locationID) {
      throw new AppError({
        action: ServerAction.OCPI_PUT_LOCATION,
        module: MODULE_NAME, method: 'putLocationRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get Orgs
    const { company, site, siteArea } = await this.getOrganizationFromLocationID(
      tenant, ocpiEndpoint, locationID, ServerAction.OCPI_PUT_LOCATION, false);
    // Update/Create Location
    if (locationID && !evseUID && !connectorID) {
      await this.putLocation(tenant, locationID, req.body as OCPILocation, company, site, siteArea, countryCode, partyID);
    }
    // Update Evse
    if (locationID && evseUID && !connectorID) {
      await this.putEvse(tenant, locationID, evseUID, req.body as OCPIEvse, company, site, siteArea);
    }
    // Update Connector
    if (locationID && evseUID && connectorID) {
      const connector = req.body as OCPIConnector;
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
    const connectorID = urlSegment.shift();
    if (!countryCode || !partyID || !locationID) {
      throw new AppError({
        action: ServerAction.OCPI_PATCH_LOCATION,
        module: MODULE_NAME, method: 'patchLocationRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get the Orgs
    const { company, site, siteArea } = await this.getOrganizationFromLocationID(
      tenant, ocpiEndpoint, locationID, ServerAction.OCPI_PATCH_LOCATION, true);
    // Update Location
    if (locationID && !evseUID && !connectorID) {
      await this.patchLocation(tenant, locationID, req.body as OCPILocation, company, site, siteArea);
    }
    // Update Evse
    if (locationID && evseUID && !connectorID) {
      await this.patchEvse(tenant, locationID, evseUID, req.body as OCPIEvse, company, site, siteArea);
    }
    // Update Connector
    if (locationID && evseUID && connectorID) {
      const connector = req.body as OCPIConnector;
    }
    return OCPIUtils.success();
  }

  private async putLocation(tenant: Tenant, locationID: string, location: OCPILocation,
      company: Company, site: Site, siteArea: SiteArea, countryCode: string, partyID: string): Promise<void> {
    if (location.id !== locationID) {
      throw new AppError({
        action: ServerAction.OCPI_PUT_LOCATION,
        module: MODULE_NAME, method: 'putLocation',
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
        chargingStationID: evseUID,
        companyID: company.id,
        siteID: site?.id,
        siteAreaID: siteArea?.id,
        action: ServerAction.OCPI_PUT_LOCATION,
        module: MODULE_NAME, method: 'putEvse',
        errorCode: StatusCodes.NOT_FOUND,
        message: `EVSE ID '${evseUID}' mismatch in URL for Location ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evse }
      });
    }
    // Site Area (Location) must exists
    if (!siteArea?.ocpiData?.location) {
      throw new AppError({
        chargingStationID: evseUID,
        companyID: company.id,
        siteID: site?.id,
        siteAreaID: siteArea?.id,
        action: ServerAction.OCPI_PUT_LOCATION,
        module: MODULE_NAME, method: 'putEvse',
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

  private async patchLocation(tenant: Tenant, locationID: string, location: OCPILocation,
      company: Company, site: Site, siteArea: SiteArea): Promise<void> {
    if (locationID !== location.id) {
      throw new AppError({
        action: ServerAction.OCPI_PATCH_LOCATION,
        module: MODULE_NAME, method: 'patchLocation',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Location ID '${locationID}' mismatch in URL`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, location }
      });
    }
    // Check Location in Site Area
    if (!siteArea.ocpiData?.location) {
      throw new AppError({
        action: ServerAction.OCPI_PATCH_LOCATION,
        module: MODULE_NAME, method: 'patchLocation',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area has no Location with ID '${locationID}'`,
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
    if (evse.uid !== evseUID) {
      throw new AppError({
        chargingStationID: evseUID,
        companyID: company.id,
        siteID: site.id,
        siteAreaID: siteArea.id,
        action: ServerAction.OCPI_PATCH_LOCATION,
        module: MODULE_NAME, method: 'patchEvse',
        errorCode: StatusCodes.NOT_FOUND,
        message: `EVSE ID '${evseUID}' mismatch in URL for Location ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evse }
      });
    }
    // Site Area (Location) must exists
    if (!siteArea?.ocpiData?.location) {
      throw new AppError({
        chargingStationID: evseUID,
        companyID: company.id,
        siteID: site.id,
        siteAreaID: siteArea.id,
        action: ServerAction.OCPI_PATCH_LOCATION,
        module: MODULE_NAME, method: 'patchEvse',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area does not exists for Location ID'${locationID}' and EVSE ID '${evseUID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evse }
      });
    }
    // Get the Charging Station
    const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationUid(
      tenant, locationID, evse.uid);
    if (!chargingStation) {
      throw new AppError({
        chargingStationID: evseUID,
        companyID: company.id,
        siteID: site.id,
        siteAreaID: siteArea.id,
        action: ServerAction.OCPI_PATCH_LOCATION,
        module: MODULE_NAME, method: 'patchEvse',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Charging Station with EVSE ID '${evseUID}' does not exists in Location ID'${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, evseUID, evse }
      });
    }
    // Check Evse in Charging Station
    if (!chargingStation.ocpiData?.evses) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_PATCH_LOCATION,
        module: MODULE_NAME, method: 'patchEvse',
        errorCode: StatusCodes.NOT_FOUND,
        message: 'Charging Station has no OCPI EVSE data',
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, location, siteArea }
      });
    }
    // Get the EVSE
    const foundEvse = chargingStation.ocpiData.evses.find(
      (chargingStationEvse) => chargingStationEvse.uid === evseUID);
    if (!foundEvse) {
      throw new AppError({
        ...LoggingHelper.getChargingStationProperties(chargingStation),
        action: ServerAction.OCPI_PATCH_LOCATION,
        module: MODULE_NAME, method: 'patchEvse',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Charging Station has no EVSE with ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, location, siteArea }
      });
    }
    // Patch
    const patchedEvse = {
      ...foundEvse,
      ...evse,
    };
    // Process Charging Station
    await OCPIUtils.processEMSPLocationChargingStation(
      tenant, siteArea.ocpiData.location, site, siteArea, patchedEvse, ServerAction.OCPI_PATCH_LOCATION);
  }

  private async getOrganizationFromLocationID(tenant: Tenant, ocpiEndpoint: OCPIEndpoint, locationID: string,
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
        detailedMessages: { locationID, ocpiEndpoint }
      });
    }
    if (orgMustExist && !siteArea?.ocpiData?.location?.id) {
      throw new AppError({
        action, module: MODULE_NAME, method: 'getOrganizationFromLocationID',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site Area does not have an OCPI Location for Location ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, ocpiEndpoint }
      });
    }
    if (orgMustExist && !siteArea.site) {
      throw new AppError({
        action, module: MODULE_NAME, method: 'getOrganizationFromLocationID',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Site does not exist for Location ID '${locationID}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationID, ocpiEndpoint }
      });
    }
    return { company, siteArea, site: siteArea?.site };
  }

  // private async processEMSPLocation(tenant: Tenant, location: OCPILocation, company: Company, site: Site, siteArea: SiteArea, siteName: string): Promise<Site> {
  //   // Remove EVSEs from location
  //   location = Utils.cloneObject(location);
  //   const evses = location.evses;
  //   delete location.evses;
  //   // Handle Site
  //   site = await OCPIUtils.processEMSPLocationSite(tenant, location, company, site);
  //   // Handle Site Area
  //   const siteArea = await OCPIUtils.processEMSPLocationSiteArea(tenant, location, site);
  //   // Handle EVSEs
  //   if (!Utils.isEmptyArray(evses)) {
  //     for (const evse of evses) {
  //       try {
  //         await OCPIUtils.processEMSPLocationChargingStation(tenant, evse, location, site, siteArea);
  //       } catch (error) {
  //         await Logging.logError({
  //           tenantID: tenant.id,
  //           action: ServerAction.OCPI_PULL_LOCATIONS,
  //           module: MODULE_NAME, method: 'processEMSPLocation',
  //           message: `Error while processing the EVSE UID '${evse.uid}' (ID '${evse.evse_id}') in Location '${location.name}'`,
  //           detailedMessages: { error: error.stack, evse, location, site, siteArea }
  //         });
  //       }
  //     }
  //   }
  //   return site;
  // }

  // private async patchEvse(tenant: Tenant, chargingStation: ChargingStation, evse: OCPIEvse, newEvse: OCPIEvse,
  //     location: OCPILocation, site: Site, siteArea: SiteArea) {
  //   // Update Status
  //   if (evse.status) {
  //     // Delete Charging Station
  //     if (evse.status === OCPIEvseStatus.REMOVED) {
  //       await ChargingStationStorage.deleteChargingStation(tenant, chargingStation.id);
  //       return;
  //     }
  //     // Update
  //     evse.status = newEvse.status;
  //     // Update the Charging Station's connectors
  //     const status = OCPIUtilsService.convertOCPIStatus2Status(evse.status);
  //     let connectorID = OCPIUtils.getConnectorIDFromEvseID(evse.evse_id);
  //     if (!connectorID) {
  //       connectorID = OCPIUtils.getConnectorIDFromEvseUID(evse.uid);
  //     }
  //     // Update one connector
  //     if (connectorID) {
  //       const connector = Utils.getConnectorFromID(chargingStation, Utils.convertToInt(connectorID));
  //       if (connector) {
  //         connector.status = status;
  //       }
  //     // Update all connectors
  //     } else {
  //       for (const connector of chargingStation.connectors) {
  //         connector.status = status;
  //       }
  //     }
  //   }
  //   // Update Timestamp
  //   if (evse.last_updated) {
  //     chargingStation.lastSeen = new Date(newEvse.last_updated);
  //     chargingStation.lastChangedOn = chargingStation.lastSeen;
  //     evse.last_updated = newEvse.last_updated;
  //   }
  //   // Rebuild the Charging Station
  //   // chargingStation = OCPIUtilsService.convertEvseToChargingStation(
  //   //   chargingStation, evse, location, site, siteArea, );
  //   await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
  // }

  // private async updateEvse(tenant: Tenant, evse: OCPIEvse, location: OCPILocation) {
  //   if (evse.status === OCPIEvseStatus.REMOVED) {
  //     const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationUid(
  //       tenant, location.id, evse.uid);
  //     if (chargingStation) {
  //       // Delete
  //       await ChargingStationStorage.deleteChargingStation(tenant, chargingStation.id);
  //       await Logging.logInfo({
  //         tenantID: tenant.id,
  //         action: ServerAction.OCPI_PATCH_LOCATION,
  //         message: `Charging Station '${evse.uid}' of Location '${location.name}' with ID '${location.id}' has been deleted`,
  //         module: MODULE_NAME, method: 'updateEvse',
  //         detailedMessages: location
  //       });
  //     }
  //   } else {
  //     // Create/Update
  //     // const chargingStation = OCPIUtilsService.convertEvseToChargingStation(evse, location);
  //     // await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
  //     await Logging.logDebug({
  //       tenantID: tenant.id,
  //       action: ServerAction.OCPI_PATCH_LOCATION,
  //       message: `Charging Station '${evse.uid}' of Location '${location.name}' with ID '${location.id}' has been updated`,
  //       module: MODULE_NAME, method: 'updateEvse',
  //       detailedMessages: location
  //     });
  //   }
  // }

  // private async updateConnector(tenant: Tenant, evse: OCPIEvse, evseConnector: OCPIConnector, location: OCPILocation) {
  //   const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationUid(
  //     tenant, location.id, evse.uid);
  //   if (!chargingStation) {
  //     throw new AppError({
  //       action: ServerAction.OCPI_PUT_LOCATION,
  //       module: MODULE_NAME, method: 'updateConnector',
  //       errorCode: StatusCodes.NOT_FOUND,
  //       message: `Unknown Charging Station with EVSE UID '${evse.uid}' and Location '${location.name}' with ID '${location.id}'`,
  //       ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
  //       detailedMessages: { location, evse }
  //     });
  //   }
  //   const foundConnector = chargingStation.connectors.find(
  //     (connector) => connector.id === evseConnector.id);
  //   // Update Connector
  //   if (foundConnector) {
  //     foundConnector.id = evseConnector.id;
  //     foundConnector.amperage = evseConnector.amperage;
  //     foundConnector.voltage = evseConnector.voltage;
  //     foundConnector.power = evseConnector.amperage * evseConnector.voltage;
  //     foundConnector.type = OCPIUtilsService.convertOCPIConnectorType2ConnectorType(evseConnector.standard);
  //   // Create Connector
  //   } else {
  //     chargingStation.connectors.push({
  //       id: evseConnector.id,
  //       status: ChargePointStatus.AVAILABLE,
  //       amperage: evseConnector.amperage,
  //       voltage: evseConnector.voltage,
  //       connectorId: chargingStation.connectors.length,
  //       currentInstantWatts: 0,
  //       power: evseConnector.amperage * evseConnector.voltage,
  //       type: OCPIUtilsService.convertOCPIConnectorType2ConnectorType(evseConnector.standard),
  //     });
  //   }
  //   await ChargingStationStorage.saveChargingStationConnectors(tenant, chargingStation.id, chargingStation.connectors);
  // }
}

