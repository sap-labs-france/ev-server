import AbstractODataEntities from './AbstractODataEntities';
import ChargingStation from '../../../types/ChargingStation';

export default class ODataChargingStations extends AbstractODataEntities {
  public buildParams: any;
  public returnResponse: any;

  public getObjectKey(chargingStation: ChargingStation): string {
    return chargingStation.id;
  }

  public async getChargingStations(centralServiceApi, query, req, cb) {
    try {
      // Check limit parameter
      const params = this.buildParams(query);
      // Include deleted charging stations
      params.IncludeDeleted = true;
      // Perform rest call
      const response = await centralServiceApi.getChargingStations(params);
      // Push Latitude & Longitude
      for (const chargingStation of response.data.result) {
        // Handle coordinates
        this.moveCoordinatesToRoot(chargingStation);
      }
      // Return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }
}

