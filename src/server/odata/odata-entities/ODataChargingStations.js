
const AbstractODataEntities = require('./AbstractODataEntities');

class ODataChargingStations extends AbstractODataEntities {
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

  // Custom convert to:
  // Short Latitude and Longitude
  static convert(object, req) {
    const chargingStation = super.convert(object, req);

    // shorten latitude and longitude
    if ( chargingStation.hasOwnProperty('longitude') ) {
      chargingStation.longitude = chargingStation.longitude.toFixed(15);
    }

    if ( chargingStation.hasOwnProperty('latitude') ) {
      chargingStation.latitude = chargingStation.latitude.toFixed(15);
    }

    return chargingStation;
  }
}


module.exports = ODataChargingStations;