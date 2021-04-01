import { NextFunction, Request, Response } from 'express';

import AbstractEndpoint from '../../AbstractEndpoint';
import AbstractOCPIService from '../../../AbstractOCPIService';
import AppError from '../../../../../exception/AppError';
import Constants from '../../../../../utils/Constants';
import { HTTPError } from '../../../../../types/HTTPError';
import OCPIClientFactory from '../../../../../client/ocpi/OCPIClientFactory';
import OCPIEndpoint from '../../../../../types/ocpi/OCPIEndpoint';
import { OCPILocationOptions } from '../../../../../types/ocpi/OCPILocation';
import { OCPIResponse } from '../../../../../types/ocpi/OCPIResponse';
import { OCPIStatusCode } from '../../../../../types/ocpi/OCPIStatusCode';
import OCPIUtils from '../../../OCPIUtils';
import OCPIUtilsService from '../OCPIUtilsService';
import { ServerAction } from '../../../../../types/Server';
import Tenant from '../../../../../types/Tenant';
import Utils from '../../../../../utils/Utils';

const MODULE_NAME = 'CPOLocationsEndpoint';

export default class CPOLocationsEndpoint extends AbstractEndpoint {
  public constructor(ocpiService: AbstractOCPIService) {
    super(ocpiService, 'locations');
  }

  public async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    switch (req.method) {
      case 'GET':
        return await this.getLocations(req, res, next, tenant, ocpiEndpoint);
    }
  }

  private async getLocations(req: Request, res: Response, next: NextFunction, tenant: Tenant, ocpiEndpoint: OCPIEndpoint): Promise<OCPIResponse> {
    // Split URL Segments
    //   /ocpi/cpo/2.0/locations/{location_id}
    //   /ocpi/cpo/2.0/locations/{location_id}/{evse_uid}
    //   /ocpi/cpo/2.0/locations/{location_id}/{evse_uid}/{connector_id}
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
    const options: OCPILocationOptions = {
      addChargeBoxID: true,
      countryID: ocpiClient.getLocalCountryCode(ServerAction.OCPI_GET_LOCATIONS),
      partyID: ocpiClient.getLocalPartyID(ServerAction.OCPI_GET_LOCATIONS)
    };
    // Process request
    if (locationId && evseUid && connectorId) {
      payload = await OCPIUtilsService.getConnector(tenant, locationId, evseUid, connectorId, options);
      // Check if at least of site found
      if (!payload) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getLocationRequest',
          action: ServerAction.OCPI_GET_LOCATIONS,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `Connector ID '${connectorId}' not found on Charging Station ID '${evseUid}' and Location ID '${locationId}'`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } else if (locationId && evseUid) {
      payload = await OCPIUtilsService.getEvse(tenant, locationId, evseUid, options);
      // Check if at least of site found
      if (!payload) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getLocationRequest',
          action: ServerAction.OCPI_GET_LOCATIONS,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `Charging Station ID not found '${evseUid}' on Location ID '${locationId}'`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } else if (locationId) {
      // Get single location
      payload = await OCPIUtilsService.getLocation(tenant, locationId, options);
      // Check if at least of site found
      if (!payload) {
        throw new AppError({
          source: Constants.CENTRAL_SERVER,
          module: MODULE_NAME, method: 'getLocationRequest',
          action: ServerAction.OCPI_GET_LOCATIONS,
          errorCode: HTTPError.GENERAL_ERROR,
          message: `Site ID '${locationId}' not found`,
          ocpiError: OCPIStatusCode.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } else {
      // Get query parameters
      const offset = (req.query.offset) ? Utils.convertToInt(req.query.offset) : 0;
      const limit = (req.query.limit && Utils.convertToInt(req.query.limit) < Constants.OCPI_RECORDS_LIMIT) ? Utils.convertToInt(req.query.limit) : Constants.OCPI_RECORDS_LIMIT;
      // Get all locations
      const locations = await OCPIUtilsService.getAllLocations(tenant, limit, offset, options, true);
      payload = locations.result;
      // Set header
      res.set({
        'X-Total-Count': locations.count,
        'X-Limit': Constants.OCPI_RECORDS_LIMIT
      });
      // Return next link
      const nextUrl = OCPIUtils.buildNextUrl(req, this.getBaseUrl(req), offset, limit, locations.count);
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

