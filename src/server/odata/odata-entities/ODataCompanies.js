
const AbstractODataEntities = require('./AbstractODataEntities');
const _ = require('lodash');

class ODataCompanies extends AbstractODataEntities {
  static getObjectKey(company) {
    return company.id;
  }

  static async getCompanies(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getCompanies(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Custom convert to:
  // Move Address object to same level
  static convert(object, req) {
    const company = super.convert(object, req);

    // shorten latitude and longitude
    if (company.hasOwnProperty('address')) { 
      if ( company.address.hasOwnProperty('longitude') ) {
        company.address.longitude = company.address.longitude.toFixed(15);
      }

      if ( company.address.hasOwnProperty('latitude') ) {
        company.address.latitude = company.address.latitude.toFixed(15);
      }
    }

    return company.address ? _.merge(company, company.address) : company;
  }
}


module.exports = ODataCompanies;