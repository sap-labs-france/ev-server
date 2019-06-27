
import _ from 'lodash';
import AbstractODataEntities from './AbstractODataEntities';

export default class ODataSiteAreas extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  static getObjectKey(siteArea) {
    return siteArea.id;
  }

  static async getSiteAreas(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = ODataSiteAreas.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getSiteAreas(params);
      // Return response
      ODataSiteAreas.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Move Address object to same level
  static convert(object, req) {
    const siteArea = super.convert(object, req);
    return siteArea.address ? _.merge(siteArea, siteArea.address) : siteArea;
  }
}

