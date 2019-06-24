import AbstractODataEntities from './AbstractODataEntities';
import _ from 'lodash';
import Company from '../../../types/Company';

export default class ODataCompanies extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  static getObjectKey(company: Company) {
    return company.id;
  }

  static async getCompanies(centralServiceApi, query, req, cb) {
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

  // Custom convert to:
  // Move Address object to same level
  static convert(object, req) {
    const company: Company = super.convert(object, req);
    return company.address ? _.merge(company, company.address) : company;
  }
  // TODO ^^^ Check this
}

