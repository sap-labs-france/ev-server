
import AbstractODataEntities from './AbstractODataEntities';
import _ from 'lodash';

export default class ODataSites extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  static getObjectKey(site) {
    return site.id;
  }

  static async getSites(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = this.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getSites(params);
      // Return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Move Address object to same level
  static convert(object, req) {
    const site = super.convert(object, req);
    return site.address ? _.merge(site, site.address) : site;
  }
}

