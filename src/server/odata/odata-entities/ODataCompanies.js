
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataCompanies extends AbstractODataEntities {
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
}


module.exports = ODataCompanies;