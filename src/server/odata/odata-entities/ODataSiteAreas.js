
const AbstractODataEntities = require('./AbstractODataEntities');
const _ = require('lodash');

class ODataSiteAreas extends AbstractODataEntities {
  static getObjectKey(siteArea) {
    return siteArea.id;
  }

  static async getSiteAreas(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getSiteAreas(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Custom convert to:
  // Move Adress object to same level
  static convert(object, req) {
    const siteArea = super.convert(object, req);

    // shorten latitude and longitude
    if (siteArea.hasOwnProperty('address')) { 
      if ( siteArea.address.hasOwnProperty('longitude') ) {
        siteArea.address.longitude = siteArea.address.longitude.toFixed(15);
      }

      if ( siteArea.address.hasOwnProperty('latitude') ) {
        siteArea.address.latitude = siteArea.address.latitude.toFixed(15);
      }
    }

    return siteArea.address ? _.merge(siteArea, siteArea.address):siteArea;
  }
}


module.exports = ODataSiteAreas;