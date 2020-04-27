import { NextFunction, Request, Response } from 'express';
import OCPIClientFactory from '../../../../client/ocpi/OCPIClientFactory';
import AppError from '../../../../exception/AppError';
import { HTTPError } from '../../../../types/HTTPError';
import OCPIEndpoint from '../../../../types/ocpi/OCPIEndpoint';
import { OCPIResponse } from '../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../types/ocpi/OCPIStatusCode';
import { ServerAction } from '../../../../types/Server';
import Tenant from '../../../../types/Tenant';
import Constants from '../../../../utils/Constants';
import Utils from '../../../../utils/Utils';
import AbstractOCPIService from '../../AbstractOCPIService';
import OCPIUtils from '../../OCPIUtils';
import AbstractEndpoint from '../AbstractEndpoint';
import OCPILocationsService from './OCPILocationsService';
import OCPIMapping from './OCPIMapping';

const EP_IDENTIFIER = 'locations';
const MODULE_NAME = 'CPOLocationsEndpoint';
const RECORDS_LIMIT = 20;

/**
 * Locations Endpoint
 */export default class CPOLocationsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return await this.getLocationsRequest(req, res, next, tenant, ocpiEndpoint);
    }
  }

  /**
   * Get Locations according to the requested url Segment
   */
  async getLocationsRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    // Split URL Segments
    //    /ocpi/cpo/2.0/locations/{location_id}
    //    /ocpi/cpo/2.0/locations/{location_id}/{evse_uid}
    //    /ocpi/cpo/2.0/locations/{location_id}/{evse_uid}/{connector_id}
    const urlSegment = req.path.substring(1).split('/');
    // Remove action
    urlSegment.shift();
    // Get filters
    const locationId = urlSegment.shift();
    const evseUid = urlSegment.shift();
    const connectorId = urlSegment.shift();
    let payload = {};
    const ocpiClient = await OCPIClientFactory.getOcpiClient(tenant, ocpiEndpoint);
    // Define get option
    const options = {
      addChargeBoxID: true,
      countryID: ocpiClient.getLocalCountryCode(ServerAction.OCPI_GET_LOCATIONS),
      partyID: ocpiClient.getLocalPartyID(ServerAction.OCPI_GET_LOCATIONS)
    };
    // Process request
    if (locationId && evseUid && connectorId) {
      payload = await OCPILocationsService.getConnector(tenant, locationId, evseUid, connectorId, options);
      // Check if at least of site found
      if (!payload) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getLocationRequest',
          action: ServerAction.OCPI_GET_LOCATIONS,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `Connector id '${connectorId}' not found on EVSE uid '${evseUid}' and location id '${locationId}'`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } else if (locationId && evseUid) {
      payload = await OCPILocationsService.getEvse(tenant, locationId, evseUid, options);
      // Check if at least of site found
      if (!payload) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getLocationRequest',
          action: ServerAction.OCPI_GET_LOCATIONS,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `EVSE uid not found '${evseUid}' on location id '${locationId}'`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } else if (locationId) {
      // Get single location
      payload = await OCPILocationsService.getLocation(tenant, locationId, options);

      // Check if at least of site found
      if (!payload) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getLocationRequest',
          action: ServerAction.OCPI_GET_LOCATIONS,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `Site id '${locationId}' not found`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } else {
      // Get query parameters
      const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
      const limit = (req.query.limit && req.query.limit < RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : RECORDS_LIMIT;
      // Get all locations
      const result = await OCPIMapping.getAllLocations(tenant, limit, offset, options);
      payload = result.locations;
      // Set header
      res.set({
        'X-Total-Count': result.count,
        'X-Limit': RECORDS_LIMIT
      });
      // Return next link
      const nextUrl = OCPIUtils.buildNextUrl(req, this.getBaseUrl(req), offset, limit, result.count);
      if (nextUrl) {
        res.links({
          next: nextUrl
        });
      }
    }
    // Return Payload
    return OCPIUtils.success(payload);
  }


}

