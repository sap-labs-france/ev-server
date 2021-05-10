import AbstractODataEntities from './AbstractODataEntities';
import { Connector } from '../../../types/ChargingStation';

export default class ODataConnectors extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  public getObjectKey(connector: Connector): string {
    return connector.id;
  }

  public async getConnectors(centralServiceApi, query, req, cb): Promise<void> {
    try {
      // Check limit parameter
      const params = this.buildParams(query);
      // Perform rest call
      const response = await centralServiceApi.getChargingStations(params);
      // Return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }
}

