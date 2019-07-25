
import _ from 'lodash';
import AbstractODataEntities from './AbstractODataEntities';

export default class ODataSiteAreas extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  public getObjectKey(siteArea) {
    return siteArea.id;
  }

  public async getSiteAreas(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = this.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getSiteAreas(params);
      // Return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }

  // Move Address object to same level
  public convert(object, req) {
    const siteArea = super.convert(object, req);
    return siteArea.address ? _.merge(siteArea, siteArea.address) : siteArea;
  }
}

