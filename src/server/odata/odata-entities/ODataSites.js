
const AbstractODataEntities = require('./AbstractODataEntities');
const _ = require('lodash');

class ODataSites extends AbstractODataEntities {
  static getObjectKey(site) {
    return site.id;
  }

  static async getSites(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getSites(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Custom convert to:
  // Move Adress object to same level
  static convert(object, req) {
    const site = super.convert(object, req);

    // shorten latitude and longitude
    if (site.hasOwnProperty('address')) { 
      if ( site.address.hasOwnProperty('longitude') ) {
        site.address.longitude = site.address.longitude.toFixed(15);
      }

      if ( site.address.hasOwnProperty('latitude') ) {
        site.address.latitude = site.address.latitude.toFixed(15);
      }
    }

    return site.address ? _.merge(site, site.address) : site;
  }
}


module.exports = ODataSites;