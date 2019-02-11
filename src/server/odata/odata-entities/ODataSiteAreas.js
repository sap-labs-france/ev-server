
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataSiteAreas extends AbstractODataEntities {
  static async restRequest(centralServiceApi, query, req, cb) {
    // check limit parameter
    const params = this.buildParams(query);

    // perform rest call
    const response = await centralServiceApi.getSiteAreas(params);

    // return response
    this.returnResponse(response,query,req,cb);
  }
}


module.exports = ODataSiteAreas;