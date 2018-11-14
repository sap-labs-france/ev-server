const AbstractEndpoint = require('../AbstractEndpoint');
const SiteArea = require('../../../../entity/SiteArea');
const OCPIUtils = require('./OCPIUtils');
const OCPIResponse = require('../../OCPIResponse');
const OCPIConstants = require('../../OCPIConstants');

require('source-map-support').install();

const EP_IDENTIFIER = "locations";

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
  process(req, res, next) { // eslint-disable-line
    switch (req.method) {
      case "GET":
        // call method
        this.getLocationRequest(req, res, next);
        break;
      default:
        res.sendStatus(501);
        break;
    }
  }

  /**
   * Get Locations according to the requested url Segement
   */
  async getLocationRequest(req, res, next) { // eslint-disable-line
    // Split URL Segments
    //    /ocpi/cpo/2.0/locations/{location_id}
    //    /ocpi/cpo/2.0/locations/{location_id}/{evse_uid}
    //    /ocpi/cpo/2.0/locations/{location_id}/{evse_uid}/{connector_id}
    const urlSegment = req.path.substring(1).split('/');
    // remove action
    urlSegment.shift();
    // get filters
    const location_id = urlSegment.shift();
    const evse_id = urlSegment.shift();
    const connector_id = urlSegment.shift();

    // Get the siteAreas
    const siteAreas = await SiteArea.getSiteAreas(
      // TODO: get tenant
      "5be96fffe6a4681c5fccb7c1",
      {
        // 'search': filteredRequest.Search, 
        'withSite': true,
        'withChargeBoxes': true,
        // 'siteID': filteredRequest.SiteID
      },
      100, 0, null);

    // convert Site Areas to Locations
    const locations = await Promise.all(siteAreas.result.map(async siteArea => { // eslint-disable-line
      // convert SiteArea to Location
      return await OCPIUtils.convertSiteArea2Location(siteArea);
    }));

    // return Payload
    //res.json(locations);
    res.json(new OCPIResponse(locations).toString());
  }

}

module.exports = LocationsEndpoint;