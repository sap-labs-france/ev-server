
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataUsers extends AbstractODataEntities {
  static async getUsers(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getUsers(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }
}


module.exports = ODataUsers;