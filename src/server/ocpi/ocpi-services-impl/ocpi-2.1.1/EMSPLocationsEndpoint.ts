import { NextFunction, Request, Response } from 'express';
import { OCPIEvse, OCPIEvseStatus } from '../../../../types/ocpi/OCPIEvse';

import AbstractEndpoint from '../AbstractEndpoint';
import AbstractOCPIService from '../../AbstractOCPIService';
import AppError from '../../../../exception/AppError';
import { ChargePointStatus } from '../../../../types/ocpp/OCPPServer';
import ChargingStation from '../../../../types/ChargingStation';
import ChargingStationStorage from '../../../../storage/mongodb/ChargingStationStorage';
import Constants from '../../../../utils/Constants';
import { HTTPError } from '../../../../types/HTTPError';
import Logging from '../../../../utils/Logging';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import { OCPIConnector } from '../../../../types/ocpi/OCPIConnector';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPILocation } from '../../../../types/ocpi/OCPILocation';
import OCPIMapping from './OCPIMapping';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../OCPIUtils';
import { ServerAction } from '../../../../types/Server';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../../../types/Tenant';

const EP_IDENTIFIER = 'locations';
const MODULE_NAME = 'EMSPLocationsEndpoint';

/**
 * EMSP Locations Endpoint
 */
export default class EMSPLocationsEndpoint extends AbstractEndpoint {

  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'PATCH':
        return await this.patchLocationRequest(req, res, next, tenant, ocpiEndpoint);
      case 'PUT':
        return await this.putLocationRequest(req, res, next, tenant, ocpiEndpoint);
    }
  }

  /**
   * Notify the eMSP of partial updates to a Location, EVSEs or Connector (such as the status).
   *
   * /locations/{country_code}/{party_id}/{location_id}
   * /locations/{country_code}/{party_id}/{location_id}/{evse_uid}
   * /locations/{country_code}/{party_id}/{location_id}/{evse_uid}/{connector_id}
   */
  private async patchLocationRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const locationId = urlSegment.shift();
    const evseUid = urlSegment.shift();
    const connectorId = urlSegment.shift();
    if (!countryCode || !partyId || !locationId) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchLocationRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    if (evseUid) {
      const chargingStationId = OCPIUtils.buildChargingStationId(locationId, evseUid);
      const chargingStation = await ChargingStationStorage.getChargingStation(tenant.id, chargingStationId);
      if (!chargingStation) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'patchLocationRequest',
          errorCode: StatusCodes.NOT_FOUND,
          message: `Unknown Charging Station ID '${evseUid}'`,
          ocpiError: OCPIStatusCode.CODE_2003_UNKNOWN_LOCATION_ERROR
        });
      }
      if (connectorId) {
        await this.patchConnector(tenant, chargingStation, connectorId, req.body);
      } else {
        await this.patchEvse(tenant, chargingStation, req.body);
      }
    } else {
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.OCPI_PATCH_LOCATIONS,
        message: `Patching of Location ID '${locationId}' is not supported currently`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchLocationRequest',
        detailedMessages: location
      });
    }
    return OCPIUtils.success();
  }

  /**
   * Push/Patch new/updated Location, EVSE and/or Connectors to the eMSP.
   *
   * /locations/{country_code}/{party_id}/{location_id}
   * /locations/{country_code}/{party_id}/{location_id}/{evse_uid}
   * /locations/{country_code}/{party_id}/{location_id}/{evse_uid}/{connector_id}
   */
  private async putLocationRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const countryCode = urlSegment.shift();
    const partyId = urlSegment.shift();
    const locationId = urlSegment.shift();
    const evseUid = urlSegment.shift();
    const connectorId = urlSegment.shift();
    if (!countryCode || !partyId || !locationId) {
      throw new AppError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateLocationRequest',
        errorCode: HTTPError.GENERAL_ERROR,
        message: 'Missing request parameters',
        ocpiError: OCPIStatusCode.CODE_2001_INVALID_PARAMETER_ERROR
      });
    }
    const siteName = OCPIUtils.buildOperatorName(countryCode, partyId);
    const ocpiClient = await OCPIClientFactory.getEmspOcpiClient(tenant, ocpiEndpoint);
    const company = await ocpiClient.getCompany();
    const sites = await SiteStorage.getSites(tenant.id, { companyIDs: [company.id], search: siteName }, Constants.DB_PARAMS_SINGLE_RECORD);
    if (evseUid && connectorId) {
      await this.updateConnector(tenant, locationId, evseUid, connectorId, req.body);
    } else if (evseUid) {
      await this.updateEvse(tenant, locationId, evseUid, req.body);
    } else {
      await ocpiClient.processLocation(req.body, company, sites.result);
    }
    return OCPIUtils.success();
  }

  private async patchEvse(tenant: Tenant, chargingStation: ChargingStation, evse: Partial<OCPIEvse>) {
    if (evse.status) {
      if (evse.status === OCPIEvseStatus.REMOVED) {
        await ChargingStationStorage.deleteChargingStation(tenant.id, chargingStation.id);
        return;
      }
      chargingStation.ocpiData.evse.status = evse.status;
      const status = OCPIMapping.convertOCPIStatus2Status(evse.status);
      chargingStation.connectors.forEach((connector) => {
        connector.status = status;
      });
    }
    if (evse.last_updated) {
      chargingStation.lastChangedOn = evse.last_updated;
      chargingStation.ocpiData.evse.last_updated = evse.last_updated;
    }
    const patchedChargingStation = OCPIMapping.convertEvseToChargingStation(chargingStation.id, evse);
    if (patchedChargingStation.coordinates) {
      chargingStation.coordinates = patchedChargingStation.coordinates;
    }
    if (patchedChargingStation.connectors && patchedChargingStation.connectors.length > 0) {
      chargingStation.connectors = patchedChargingStation.connectors;
      chargingStation.maximumPower = patchedChargingStation.maximumPower;
    }
    await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
  }

  private async patchConnector(tenant: Tenant, chargingStation: ChargingStation, connectorId: string, ocpiConnector: Partial<OCPIConnector>) {
    let found = false;
    if (chargingStation.connectors && chargingStation.connectors.length > 0) {
      for (const connector of chargingStation.connectors) {
        if (connector.id === connectorId) {
          if (ocpiConnector.id) {
            connector.id = ocpiConnector.id;
          }
          if (ocpiConnector.amperage) {
            connector.amperage = ocpiConnector.amperage;
          }
          if (ocpiConnector.voltage) {
            connector.voltage = ocpiConnector.voltage;
          }
          connector.power = connector.amperage * connector.voltage;
          if (ocpiConnector.standard) {
            connector.type = OCPIMapping.convertOCPIConnectorType2ConnectorType(ocpiConnector.standard);
          }
          await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OCPI_PATCH_LOCATIONS,
        message: `Patching of Connector ID '${connectorId}' of Charging Station '${chargingStation.id}' failed because connector was not found`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'patchConnector',
        detailedMessages: { location }
      });
    }
  }

  private async updateEvse(tenant: Tenant, locationId: string, evseUid: string, evse: OCPIEvse, location?: OCPILocation) {
    const chargingStationId = OCPIUtils.buildChargingStationId(locationId, evseUid);
    if (evse.status === OCPIEvseStatus.REMOVED) {
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.OCPI_PATCH_LOCATIONS,
        message: `Delete removed Charging Station '${evseUid}' of Location ID '${locationId}'`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateLocation',
        detailedMessages: location
      });
      await ChargingStationStorage.deleteChargingStation(tenant.id, chargingStationId);
    } else {
      Logging.logDebug({
        tenantID: tenant.id,
        action: ServerAction.OCPI_PATCH_LOCATIONS,
        message: `Update Charging Station '${evseUid}' of Location ID '${locationId}'`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateLocation',
        detailedMessages: location
      });
      const chargingStation = OCPIMapping.convertEvseToChargingStation(chargingStationId, evse, location);
      await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
    }
  }

  private async updateConnector(tenant: Tenant, locationId: string, evseUid: string, connectorId: string, ocpiConnector: OCPIConnector) {
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant.id, evseUid);
    if (!chargingStation) {
      Logging.logError({
        tenantID: tenant.id,
        action: ServerAction.OCPI_PATCH_LOCATIONS,
        message: `Unable to update connector of non existing Charging Station '${evseUid}' of Location ID '${locationId}'`,
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME, method: 'updateLocation',
        detailedMessages: { location }
      });
    } else {
      let found = false;
      for (const connector of chargingStation.connectors) {
        if (connector.id === connectorId) {
          connector.id = ocpiConnector.id;
          connector.amperage = ocpiConnector.amperage;
          connector.voltage = ocpiConnector.voltage;
          connector.power = ocpiConnector.amperage * ocpiConnector.voltage;
          connector.type = OCPIMapping.convertOCPIConnectorType2ConnectorType(ocpiConnector.standard);
          found = true;
          break;
        }
      }
      if (!found) {
        chargingStation.connectors.push({
          id: connectorId,
          status: ChargePointStatus.AVAILABLE,
          amperage: ocpiConnector.amperage,
          voltage: ocpiConnector.voltage,
          connectorId: chargingStation.connectors.length,
          currentInstantWatts: 0,
          power: ocpiConnector.amperage * ocpiConnector.voltage,
          type: OCPIMapping.convertOCPIConnectorType2ConnectorType(ocpiConnector.standard),
        });
      }
      await ChargingStationStorage.saveChargingStation(tenant.id, chargingStation);
    }
  }
}

