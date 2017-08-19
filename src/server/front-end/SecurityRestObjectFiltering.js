const CentralRestServerAuthorization = require('./CentralRestServerAuthorization');

require('source-map-support').install();

class SecurityRestObjectFiltering {
  static filterChargingStation(chargingStation, user) {
    // Must be admin to get the user/pass
    if (!CentralRestServerAuthorization.isAdmin(user)) {
      // Clear
      chargingStation.chargeBoxSerialNumber = "";
      chargingStation.chargePointModel = "";
      chargingStation.chargePointSerialNumber = "";
      chargingStation.endpoint = "";
      chargingStation.firmwareVersion = "";
      chargingStation.iccid = "";
      chargingStation.imsi = "";
      chargingStation.meterSerialNumber = "";
      chargingStation.meterType = "";
      chargingStation.ocppVersion = "";
    }
    return chargingStation;
  }

  static filterChargingStations(chargingStations, user) {
    chargingStations.forEach(chargingStation => {
      // Filter
      chargingStation = this.filterChargingStation(chargingStation, user);
    });
    return chargingStations;
  }
}

module.exports = SecurityRestObjectFiltering;
