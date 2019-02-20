
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataSiteAreas extends AbstractODataEntities {
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
}


module.exports = ODataSiteAreas;