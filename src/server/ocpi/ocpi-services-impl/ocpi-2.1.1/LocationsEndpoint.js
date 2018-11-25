const AbstractEndpoint = require('../AbstractEndpoint');
const Site = require('../../../../entity/Site');
const OCPIMapping = require('./OCPIMapping');
const OCPIUtils = require('../../OCPIUtils');
const OCPIServerError = require('../../../../exception/OCPIServerError');

require('source-map-support').install();

const EP_IDENTIFIER = "locations";
const MODULE_NAME = "locations"
const RECORDS_LIMIT = 20;

/**
 * Locations Endpoint
 */
class LocationsEndpoint extends AbstractEndpoint {
  // Create OCPI Service
  constructor() {
    super(EP_IDENTIFIER);
  }

  /**
   * Main Process Method for the endpoint
   */
  async process(req, res, next, tenant) { // eslint-disable-line
    try {
      switch (req.method) {
        case "GET":
          // call method
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
    // remove action
    urlSegment.shift();

    // get filters
    const locationId = urlSegment.shift();
    const evseUid = urlSegment.shift();
    const connectorId = urlSegment.shift();
    let payload = {};

    // process request
    if (locationId && evseUid && connectorId) {
      payload = await this.getConnector(tenant, locationId, evseUid, connectorId);

      // check if at least of site found
      if (!payload) {
        throw new OCPIServerError(
          'GET locations',
          `Connector id '${connectorId}' not found on EVSE uid '${evseUid}' and location id '${locationId}'`, 500,
          MODULE_NAME, 'getLocationRequest', null);
      }

    } else if (locationId && evseUid) {
      payload = await this.getEvse(tenant, locationId, evseUid);

      // check if at least of site found
      if (!payload) {
        throw new OCPIServerError(
          'GET locations',
          `EVSE uid not found '${evseUid}' on location id '${locationId}'`, 500,
          MODULE_NAME, 'getLocationRequest', null);
      }
    } else if (locationId) {
      // get single location
      payload = await this.getLocation(tenant, locationId);

      // check if at least of site found
      if (!payload) {
        throw new OCPIServerError(
          'GET locations',
          `Site id '${locationId}' not found`, 500,
          MODULE_NAME, 'getLocationRequest', null);
      }
    } else {
      // get query parameters
      let offset = (req.query.offset)?parseInt(req.query.offset):0;
      let limit  = (req.query.limit && req.query.limit < RECORDS_LIMIT)?parseInt(req.query.limit):RECORDS_LIMIT;

      // get all locations
      const result = await this.getAllLocations(tenant,limit,offset);
      payload = result.locations;

      // set header
      res.set({
        'X-Total-Count': result.count,
        'X-Limit': RECORDS_LIMIT
      })

      // return next link
      const nextUrl = OCPIUtils.buildNextUrl(req, offset, limit, result.count);
      if (nextUrl) {
        res.links({
          next: nextUrl
        });
      }
    }

    // return Payload
    res.json(OCPIUtils.success(payload));
  }

  /**
   * Get All OCPI Locations from given tenant
   * @param {Tenant} tenant 
   */
  async getAllLocations(tenant,limit,skip) {
    // result
    const result = { count: 0, locations: []};

    // Get all sites
    const sites = await Site.getSites(
      tenant.getID(),
      {
        'withChargeBoxes': true,
        "withSiteAreas": true
      },
      limit, skip, null);

    // convert Sites to Locations
    for (const site of sites.result) {
      result.locations.push(await OCPIMapping.convertSite2Location(tenant, site));
    }

    // set count
    result.count = sites.count;

    // return locations
    return result;
  }

  /**
   * Get OCPI Location from its id (Site ID)
   * @param {*} tenant 
   * @param {*} locationId 
   */
  async getLocation(tenant, locationId) {
    // get site
    const site = await Site.getSite(tenant.getID(), locationId);

    // convert
    return await OCPIMapping.convertSite2Location(tenant, site);
  }

  /**
   * Get OCPI EVSE from its location id/evse_id
   * @param {*} tenant 
   * @param {*} locationId 
   * @param {*} evseId 
   */
  async getEvse(tenant, locationId, evseUid) {
    // get site
    const site = await Site.getSite(tenant.getID(), locationId);

    // convert to location
    const location = await OCPIMapping.convertSite2Location(tenant, site);

    // loop through EVSE
    if (location) {
      for (const evse of location.evses) {
        if (evse.uid === evseUid) return evse;
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
    // get site
    const evse = await this.getEvse(tenant, locationId, evseUid);

    // loop through Connector
    if (evse) {
      for (const connector of evse.connectors) {
        if (connector.id == connectorId) return connector;
      }
    }
  }
}



module.exports = LocationsEndpoint;