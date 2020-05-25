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
    // Create the Company and move its address to the root
    return this.moveAddressToRoot(super.convert(object, req));
  }
}

