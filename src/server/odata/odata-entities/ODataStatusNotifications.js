
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataStatusNotifications extends AbstractODataEntities {
  static async getStatusNotifications(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getStatusNotifications(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }
}


module.exports = ODataStatusNotifications;