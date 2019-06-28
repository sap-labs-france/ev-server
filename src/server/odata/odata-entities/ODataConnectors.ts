
import AbstractODataEntities from './AbstractODataEntities';

export default class ODataConnectors extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  static async getConnectors(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = ODataConnectors.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getChargingStations(params);
      // Return response
      ODataConnectors.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }
}

