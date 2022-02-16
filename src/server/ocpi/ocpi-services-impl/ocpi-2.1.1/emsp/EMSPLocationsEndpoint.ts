import { NextFunction, Request, Response } from 'express';
import { OCPIEvse, OCPIEvseStatus } from '../../../../../types/ocpi/OCPIEvse';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import AppError from '../../../../../exception/AppError';
import { ChargePointStatus } from '../../../../../types/ocpp/OCPPServer';
import ChargingStation from '../../../../../types/ChargingStation';
import ChargingStationStorage from '../../../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../../../utils/Constants';
import { HTTPError } from '../../../../../types/HTTPError';
import Logging from '../../../../../utils/Logging';
import LoggingHelper from '../../../../../utils/LoggingHelper';
import OCPIClientFactory from '../../../../../client/ocpi/OCPIClientFactory';
import { OCPIConnector } from '../../../../../types/ocpi/OCPIConnector';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPILocation } from '../../../../../types/ocpi/OCPILocation';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import Site from '../../../../../types/Site';
import SiteArea from '../../../../../types/SiteArea';
import SiteStorage from '../../../../../storage/mongodb/SiteStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../../types/Tenant';
import Utils from '../../../../../utils/Utils';

const MODULE_NAME = 'EMSPLocationsEndpoint';

export default class EMSPLocationsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'locations');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'PATCH':
        return this.patchLocationRequest(req, res, next, tenant, ocpiEndpoint);
      case 'PUT':
        return this.putLocationRequest(req, res, next, tenant, ocpiEndpoint);
    }
  }

  private async patchLocationRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
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
        action: ServerAction.OCPI_PATCH_LOCATION,
        module: MODULE_NAME, method: 'patchLocationRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    // Get the OCPI client
    const ocpiClient = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
    // Handle Charging Station / Connector
    if (evseUID) {
      const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationUid(
        tenant, locationID, evseUID);
      if (!chargingStation) {
        throw new AppError({
          action: ServerAction.OCPI_PATCH_LOCATION,
          module: MODULE_NAME, method: 'patchLocationRequest',
          errorCode: StatusCodes.NOT_FOUND,
          message: `Unknown Charging Station with EVSE UID '${evseUID}' and Location ID '${locationID}'`,
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
          detailedMessages: { countryCode, partyID, locationID, evseUID }
        });
      }
      if (!chargingStation.siteArea) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action: ServerAction.OCPI_PATCH_LOCATION,
          module: MODULE_NAME, method: 'patchLocationRequest',
          errorCode: StatusCodes.NOT_FOUND,
          message: `Site Area ID '${chargingStation.siteAreaID}' does not exists`,
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
          detailedMessages: { countryCode, partyID, locationID, evseUID, chargingStation }
        });
      }
      if (!chargingStation.siteArea.ocpiData?.location) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action: ServerAction.OCPI_PATCH_LOCATION,
          module: MODULE_NAME, method: 'patchLocationRequest',
          errorCode: StatusCodes.NOT_FOUND,
          message: `Site Area ID '${chargingStation.siteAreaID}' does not have a location`,
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
          detailedMessages: { countryCode, partyID, locationID, evseUID, chargingStation }
        });
      }
      const location = chargingStation.siteArea.ocpiData.location;
      if (!chargingStation.site) {
        throw new AppError({
          ...LoggingHelper.getChargingStationProperties(chargingStation),
          action: ServerAction.OCPI_PATCH_LOCATION,
          module: MODULE_NAME, method: 'patchLocationRequest',
          errorCode: StatusCodes.NOT_FOUND,
          message: `Site ID '${chargingStation.siteID}' does not exists`,
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
          detailedMessages: { countryCode, partyID, locationID, evseUID, chargingStation }
        });
      }
      // Get the EVSE
      const foundEvse = chargingStation.ocpiData.evses.find((evse) => evse.uid === evseUID);
      if (!foundEvse) {
        throw new AppError({
          action: ServerAction.OCPI_PATCH_LOCATION,
          module: MODULE_NAME, method: 'patchLocationRequest',
          errorCode: StatusCodes.NOT_FOUND,
          message: `Unknown EVSE UID '${evseUID}'`,
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
          detailedMessages: { countryCode, partyID, locationID, evseUID, location }
        });
      }
      if (connectorID) {
        const evseConnector = req.body as OCPIConnector;
        // const foundEvseConnector = foundEvse.connectors.find((evseConnector) => evseConnector.id === connectorID);
        // if (!foundEvseConnector) {
        //   throw new AppError({
        //     action: ServerAction.OCPI_PATCH_LOCATION,
        //     module: MODULE_NAME, method: 'patchLocationRequest',
        //     errorCode: StatusCodes.NOT_FOUND,
        //     message: `Unknown Connector ID '${connectorID}' in EVSE UID '${evseUID}'`,
        //     ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        //     detailedMessages: { connectorId: connectorID, evse: foundEvse, location }
        //   });
        // }
        // // Patch Connector
        // await this.patchEvseConnector(tenant, chargingStation, foundEvseConnector);
      } else {
        // Patch Evse
        const newEvse = req.body as OCPIEvse;
        await this.patchEvse(tenant, chargingStation, foundEvse, newEvse, location, chargingStation.site, chargingStation.siteArea);
      }
    // Handle Location
    } else {
      const location = req.body as OCPILocation;
    }
    return OCPIUtils.success();
  }

  private async putLocationRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    urlSegment.shift();
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
    const location = req.body as OCPILocation;
    if (locationID !== location.id) {
      throw new AppError({
        action: ServerAction.OCPI_PUT_LOCATION,
        module: MODULE_NAME, method: 'putLocationRequest',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Location ID '${locationID}' mismatch in URL`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { locationId: locationID, location }
      });
    }
    if (evseUID) {
      const foundEvse = location.evses.find((evse) => evse.uid === evseUID);
      if (!foundEvse) {
        throw new AppError({
          action: ServerAction.OCPI_PUT_LOCATION,
          module: MODULE_NAME, method: 'putLocationRequest',
          errorCode: StatusCodes.NOT_FOUND,
          message: `EVSE UID '${evseUID}' mismatch in URL`,
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
          detailedMessages: { evseUid: evseUID, location }
        });
      }
      if (connectorID) {
        const foundEvseConnector = foundEvse.connectors.find(
          (evseConnector) => evseConnector.id === connectorID);
        if (!foundEvseConnector) {
          throw new AppError({
            action: ServerAction.OCPI_PUT_LOCATION,
            module: MODULE_NAME, method: 'putLocationRequest',
            errorCode: StatusCodes.NOT_FOUND,
            message: `Unknown Connector ID '${connectorID}' in EVSE UID '${evseUID}'`,
            ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
            detailedMessages: { connectorId: connectorID, evse: foundEvse, location }
          });
        }
        // Update EVSE Connector
        await this.updateConnector(tenant, foundEvse, foundEvseConnector, location);
      } else {
        // Update EVSE
        await this.updateEvse(tenant, foundEvse, location);
      }
    } else {
      // Get the Orgs
      const company = await OCPIUtils.checkAndGetEMSPCompany(tenant, ocpiEndpoint);
      const siteName = OCPIUtils.buildOperatorName(countryCode, partyID);
      const sites = await SiteStorage.getSites(tenant, { companyIDs: [company.id], name: siteName }, Constants.DB_PARAMS_SINGLE_RECORD);
      // Get the Site
      const foundSite = sites.result.find((existingSite) => existingSite.name === siteName);
      // Update Location
      await OCPIUtils.processEMSPLocation(tenant, location, company, foundSite, siteName);
    }
    return OCPIUtils.success();
  }

  private async patchEvse(tenant: Tenant, chargingStation: ChargingStation, evse: OCPIEvse, newEvse: OCPIEvse,
      location: OCPILocation, site: Site, siteArea: SiteArea) {
    // Update Status
    if (evse.status) {
      // Delete Charging Station
      if (evse.status === OCPIEvseStatus.REMOVED) {
        await ChargingStationStorage.deleteChargingStation(tenant, chargingStation.id);
        return;
      }
      // Update
      evse.status = newEvse.status;
      // Update the Charging Station's connectors
      const status = OCPIUtilsService.convertOCPIStatus2Status(evse.status);
      let connectorID = OCPIUtils.getConnectorIDFromEvseID(evse.evse_id);
      if (!connectorID) {
        connectorID = OCPIUtils.getConnectorIDFromEvseUID(evse.uid);
      }
      // Update one connector
      if (connectorID) {
        const connector = Utils.getConnectorFromID(chargingStation, Utils.convertToInt(connectorID));
        if (connector) {
          connector.status = status;
        }
      // Update all connectors
      } else {
        for (const connector of chargingStation.connectors) {
          connector.status = status;
        }
      }
    }
    // Update Timestamp
    if (evse.last_updated) {
      chargingStation.lastSeen = new Date(newEvse.last_updated);
      chargingStation.lastChangedOn = chargingStation.lastSeen;
      evse.last_updated = newEvse.last_updated;
    }
    // Rebuild the Charging Station
    chargingStation = OCPIUtilsService.convertEvseToChargingStation(
      chargingStation, evse, location, site, siteArea);
    await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
  }

  private async updateEvse(tenant: Tenant, evse: OCPIEvse, location: OCPILocation) {
    if (evse.status === OCPIEvseStatus.REMOVED) {
      const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationUid(
        tenant, location.id, evse.uid);
      if (chargingStation) {
        // Delete
        await ChargingStationStorage.deleteChargingStation(tenant, chargingStation.id);
        await Logging.logInfo({
          tenantID: tenant.id,
          action: ServerAction.OCPI_PATCH_LOCATION,
          message: `Charging Station '${evse.uid}' of Location '${location.name}' with ID '${location.id}' has been deleted`,
          module: MODULE_NAME, method: 'updateEvse',
          detailedMessages: location
        });
      }
    } else {
      // Create/Update
      // const chargingStation = OCPIUtilsService.convertEvseToChargingStation(evse, location);
      // await ChargingStationStorage.saveChargingStation(tenant, chargingStation);
      await Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.OCPI_PATCH_LOCATION,
        message: `Charging Station '${evse.uid}' of Location '${location.name}' with ID '${location.id}' has been updated`,
        module: MODULE_NAME, method: 'updateEvse',
        detailedMessages: location
      });
    }
  }

  private async updateConnector(tenant: Tenant, evse: OCPIEvse, evseConnector: OCPIConnector, location: OCPILocation) {
    const chargingStation = await ChargingStationStorage.getChargingStationByOcpiLocationUid(
      tenant, location.id, evse.uid);
    if (!chargingStation) {
      throw new AppError({
        action: ServerAction.OCPI_PUT_LOCATION,
        module: MODULE_NAME, method: 'updateConnector',
        errorCode: StatusCodes.NOT_FOUND,
        message: `Unknown Charging Station with EVSE UID '${evse.uid}' and Location '${location.name}' with ID '${location.id}'`,
        ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR,
        detailedMessages: { location, evse }
      });
    }
    const foundConnector = chargingStation.connectors.find(
      (connector) => connector.id === evseConnector.id);
    // Update Connector
    if (foundConnector) {
      foundConnector.id = evseConnector.id;
      foundConnector.amperage = evseConnector.amperage;
      foundConnector.voltage = evseConnector.voltage;
      foundConnector.power = evseConnector.amperage * evseConnector.voltage;
      foundConnector.type = OCPIUtilsService.convertOCPIConnectorType2ConnectorType(evseConnector.standard);
    // Create Connector
    } else {
      chargingStation.connectors.push({
        id: evseConnector.id,
        status: ChargePointStatus.AVAILABLE,
        amperage: evseConnector.amperage,
        voltage: evseConnector.voltage,
        connectorId: chargingStation.connectors.length,
        currentInstantWatts: 0,
        power: evseConnector.amperage * evseConnector.voltage,
        type: OCPIUtilsService.convertOCPIConnectorType2ConnectorType(evseConnector.standard),
      });
    }
    await ChargingStationStorage.saveChargingStationConnectors(tenant, chargingStation.id, chargingStation.connectors);
  }
}

