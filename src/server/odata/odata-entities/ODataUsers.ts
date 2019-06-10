import AbstractODataEntities from './AbstractODataEntities';

export default class ODataUsers extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  static getObjectKey(user) {
    return user.id;
  }

  static async getUsers(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = this.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getUsers(params);
      // Return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }
}


