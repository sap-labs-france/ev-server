
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataConnectors extends AbstractODataEntities {
  static async getConnectors(centralServiceApi, query, req, cb) {
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


module.exports = ODataConnectors;