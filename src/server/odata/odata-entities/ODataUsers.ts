import AbstractODataEntities from './AbstractODataEntities';
import User from '../../../types/User';

export default class ODataUsers extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  public getObjectKey(user: User): string {
    return user.id;
  }

  public async getUsers(centralServiceApi, query, req, cb): Promise<void> {
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

