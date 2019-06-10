
import AbstractODataEntities from './AbstractODataEntities';
import _ from 'lodash';
export default class ODataCompanies extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  static getObjectKey(company) {
    return company.id;
  }

  static async getCompanies(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // perform rest call
      const response = await centralServiceApi.getCompanies(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Custom convert to:
  // Move Address object to same level
  static convert(object, req) {
    const company = super.convert(object, req);
    return company.address ? _.merge(company, company.address) : company;
  }
}


