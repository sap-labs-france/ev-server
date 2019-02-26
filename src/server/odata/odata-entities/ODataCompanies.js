
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
  // Move Adress object to same level
  static convert(object, req) {
    const company = super.convert(object, req);
    return company.address ? _.merge(company, company.address) : company;
  }
}


module.exports = ODataCompanies;