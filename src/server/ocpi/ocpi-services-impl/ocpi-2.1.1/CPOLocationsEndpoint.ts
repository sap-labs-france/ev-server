import AbstractEndpoint from '../AbstractEndpoint';
import Constants from '../../../../utils/Constants';
import OCPIMapping from './OCPIMapping';
import OCPIUtils from '../../OCPIUtils';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';
import { NextFunction, Request, Response } from 'express';
import Tenant from '../../../../types/Tenant';
import AppError from '../../../../exception/AppError';
import AbstractOCPIService from '../../AbstractOCPIService';

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
  async process(req: Request, res: Response, next: NextFunction, tenant: Tenant, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    switch (req.method) {
      case 'GET':
        // Call method
        await this.getLocationsRequest(req, res, next, tenant, options);
        break;
      default:
        res.sendStatus(501);
        break;
    }
  }

  /**
   * Get Locations according to the requested url Segment
   */
  async getLocationsRequest(req: Request, res: Response, next: NextFunction, tenant: Tenant, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
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

    // Process request
    if (locationId && evseUid && connectorId) {
      payload = await this.getConnector(tenant, locationId, evseUid, connectorId, options);

      // Check if at least of site found
      if (!payload) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'getLocationRequest',
          action: 'OcpiGetLocations',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `Connector id '${connectorId}' not found on EVSE uid '${evseUid}' and location id '${locationId}'`,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
        });
      }

    } else if (locationId && evseUid) {
      payload = await this.getEvse(tenant, locationId, evseUid, options);

      // Check if at least of site found
      if (!payload) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'getLocationRequest',
          action: 'OcpiGetLocations',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `EVSE uid not found '${evseUid}' on location id '${locationId}'`,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } else if (locationId) {
      // Get single location
      payload = await this.getLocation(tenant, locationId, options);

      // Check if at least of site found
      if (!payload) {
        throw new AppError({
          source: Constants.OCPI_SERVER,
          module: MODULE_NAME,
          method: 'getLocationRequest',
          action: 'OcpiGetLocations',
          errorCode: Constants.HTTP_GENERAL_ERROR,
          message: `Site id '${locationId}' not found`,
          ocpiError: Constants.OCPI_STATUS_CODE.CODE_3000_GENERIC_SERVER_ERROR
        });
      }
    } else {
      // Get query parameters
      const offset = (req.query.offset) ? parseInt(req.query.offset) : 0;
      const limit = (req.query.limit && req.query.limit < RECORDS_LIMIT) ? parseInt(req.query.limit) : RECORDS_LIMIT;

      // Get all locations
      const result = await OCPIMapping.getAllLocations(tenant, limit, offset, options);
      payload = result.locations;

      // Set header
      res.set({
        'X-Total-Count': result.count,
        'X-Limit': RECORDS_LIMIT
      });

      // Return next link
      const nextUrl = OCPIUtils.buildNextUrl(req, offset, limit, result.count);
      if (nextUrl) {
        res.links({
          next: nextUrl
        });
      }
    }

    // Return Payload
    res.json(OCPIUtils.success(payload));
  }

  /**
   * Get OCPI Location from its id (Site ID)
   * @param {*} tenant
   * @param {*} locationId
   */
  async getLocation(tenant: Tenant, locationId: string, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    // Get site
    const site = await SiteStorage.getSite(tenant.id, locationId);
    if (!site) {
      return null;
    }

    // Convert
    return await OCPIMapping.convertSite2Location(tenant, site, options);
  }

  /**
   * Get OCPI EVSE from its location id/evse_id
   * @param {*} tenant
   * @param {*} locationId
   * @param {*} evseId
   */
  async getEvse(tenant: Tenant, locationId: string, evseUid: string, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    // Get site
    const site = await SiteStorage.getSite(tenant.id, locationId);

    // Convert to location
    const location = await OCPIMapping.convertSite2Location(tenant, site, options);

    // Loop through EVSE
    if (location) {
      for (const evse of location.evses) {
        if (evse.uid === evseUid) {
          return evse;
        }
      }
    }
  }

  /**
   * Get OCPI Connector from its location_id/evse_uid/connector id
   * @param {*} tenant
   * @param {*} locationId
   * @param {*} evseUid
   * @param {*} connectorId
   */
  async getConnector(tenant: Tenant, locationId: string, evseUid: string, connectorId: string, options: { countryID: string; partyID: string; addChargeBoxID?: boolean }) {
    // Get site
    const evse = await this.getEvse(tenant, locationId, evseUid, options);

    // Loop through Connector
    if (evse) {
      for (const connector of evse.connectors) {
        if (connector.id === connectorId) {
          return connector;
        }
      }
    }
  }
}

