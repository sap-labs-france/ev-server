import AbstractODataEntities from './AbstractODataEntities';
import User from '../../../types/User';

export default class ODataUsers extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  public getObjectKey(user: User) {
    return user.id;
  }

  public async getUsers(centralServiceApi, query, req, cb) {
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

