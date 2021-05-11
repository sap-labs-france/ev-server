import AbstractODataEntities from './AbstractODataEntities';
import Company from '../../../types/Company';
import _ from 'lodash';

export default class ODataCompanies extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  public getObjectKey(company: Company): string {
    return company.id;
  }

  public async getCompanies(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = this.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getCompanies(params);
      // Return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Move Address object to same level
  public convert(object, req) {
    // Create the Company and move its address to the root
    return this.moveAddressToRoot(super.convert(object, req));
  }
}
