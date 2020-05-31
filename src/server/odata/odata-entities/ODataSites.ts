import AbstractODataEntities from './AbstractODataEntities';

export default class ODataSites extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  public getObjectKey(site) {
    return site.id;
  }

  public async getSites(centralServiceApi, query, req, cb) {
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
  public convert(object, req) {
    // Create the Site and move its address to the root
    return this.moveAddressToRoot(super.convert(object, req));
  }
}
