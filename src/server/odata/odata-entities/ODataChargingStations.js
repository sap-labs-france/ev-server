
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataChargingStations extends AbstractODataEntities {
  static async restRequest(centralServiceApi, query, req, cb) {
    // check limit parameter
    const params = this.buildParams(query);

    // perform rest call
    const response = await centralServiceApi.getChargingStations(params);

    // return response
    this.returnResponse(response,query,req,cb);
  }
}


module.exports = ODataChargingStations;