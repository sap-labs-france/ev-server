import SourceMap from 'source-map-support';
import AbstractEndpoint from '../AbstractEndpoint';
import OCPIMapping from './OCPIMapping';
import OCPIServerError from '../../../../exception/OCPIServerError';
import OCPIUtils from '../../OCPIUtils';
import SiteStorage from '../../../../storage/mongodb/SiteStorage';

SourceMap.install();

const EP_IDENTIFIER = 'locations';
const EP_VERSION = '2.1.1';

const RECORDS_LIMIT = 20;

/**
 * Locations Endpoint
 */export default class LocationsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor(ocpiService) {
    super(ocpiService, EP_IDENTIFIER, EP_VERSION);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req, res, next, tenant) { // eslint-disable-line
    try {
      switch (req.method) {
        case 'GET':
          // Call method
          await this.getLocationRequest(req, res, next, tenant);
          break;
        default:
          res.sendStatus(501);
          break;
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Locations according to the requested url Segement
   */
  async getLocationRequest(req, res, next, tenant) { // eslint-disable-line
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
      payload = await this.getConnector(tenant, locationId, evseUid, connectorId);

      // Check if at least of site found
      if (!payload) {
        throw new OCPIServerError(
          'GET locations',
          `Connector id '${connectorId}' not found on EVSE uid '${evseUid}' and location id '${locationId}'`, Constants.HTTP_GENERAL_ERROR,
          EP_IDENTIFIER, 'getLocationRequest');
      }

    } else if (locationId && evseUid) {
      payload = await this.getEvse(tenant, locationId, evseUid);

      // Check if at least of site found
      if (!payload) {
        throw new OCPIServerError(
          'GET locations',
          `EVSE uid not found '${evseUid}' on location id '${locationId}'`, Constants.HTTP_GENERAL_ERROR,
          EP_IDENTIFIER, 'getLocationRequest');
      }
    } else if (locationId) {
      // Get single location
      payload = await this.getLocation(tenant, locationId);

      // Check if at least of site found
      if (!payload) {
        throw new OCPIServerError(
          'GET locations',
          `Site id '${locationId}' not found`, Constants.HTTP_GENERAL_ERROR,
          EP_IDENTIFIER, 'getLocationRequest');
      }
    } else {
      // Get query parameters
      const offset = (req.query.offset) ? parseInt(req.query.offset) : 0;
      const limit = (req.query.limit && req.query.limit < RECORDS_LIMIT) ? parseInt(req.query.limit) : RECORDS_LIMIT;

      // Get all locations
      const result = await this.getAllLocations(tenant, limit, offset);
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
   * Get All OCPI Locations from given tenant TODO: move to OCPIMapping
   * @param {Tenant} tenant
   */
  async getAllLocations(tenant, limit, skip) {
    // Result
    const result = { count: 0, locations: [] };

    // Get all sites
    const sites = await SiteStorage.getSites(tenant.getID(), {}, { limit, skip });

    // Convert Sites to Locations
    for (const site of sites.result) {
      result.locations.push(await OCPIMapping.convertSite2Location(tenant, site));
    }

    // Set count
    result.count = sites.count;

    // Return locations
    return result;
  }

  /**
   * Get OCPI Location from its id (Site ID)
   * @param {*} tenant
   * @param {*} locationId
   */
  async getLocation(tenant, locationId) {
    // Get site
    const site = await SiteStorage.getSite(tenant.getID(), locationId);
    if(!site) {
      return null;
    }

    // Convert
    return await OCPIMapping.convertSite2Location(tenant, site);
  }

  /**
   * Get OCPI EVSE from its location id/evse_id
   * @param {*} tenant
   * @param {*} locationId
   * @param {*} evseId
   */
  async getEvse(tenant, locationId, evseUid) {
    // Get site
    const site = await SiteStorage.getSite(tenant.getID(), locationId);

    // Convert to location
    const location = await OCPIMapping.convertSite2Location(tenant, site);

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
  async getConnector(tenant, locationId, evseUid, connectorId) {
    // Get site
    const evse = await this.getEvse(tenant, locationId, evseUid);

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

