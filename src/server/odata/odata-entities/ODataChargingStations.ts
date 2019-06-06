
import AbstractODataEntities from './AbstractODataEntities';
export default class ODataChargingStations extends AbstractODataEntities {
	public buildParams: any;
	public returnResponse: any;

  static getObjectKey(chargingStation) {
    return chargingStation.id;
  }

  static async getChargingStations(centralServiceApi, query, req, cb) {
    try {
      // check limit parameter
      const params = this.buildParams(query);

      // include deleted charging stations
      params.IncludeDeleted = true;

      // perform rest call
      const response = await centralServiceApi.getChargingStations(params);

      // return response
      this.returnResponse(response, query, req, cb);
    } catch (error) {
      cb(error);
    }
  }
}


