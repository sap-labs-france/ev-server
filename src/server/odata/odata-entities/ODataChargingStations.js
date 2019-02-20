
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataChargingStations extends AbstractODataEntities {
  static async getChargingStations(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getChargingStations(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }
}


module.exports = ODataChargingStations;