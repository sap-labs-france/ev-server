const Constants = require('../utils/Constants');
const Configuration = require('../utils/Configuration');
const BackendError = require('../exception/BackendError');

class ChargingStationClient {
  constructor() {
    if (new.target === ChargingStationClient) {
      throw new TypeError("Cannot construct ChargingStationClient instances directly");
    }
  }

  /**
   *
   * Return the proper Client instance interface to handle request actions
   * @static
   * @param {*} chargingStation: instance of ChargingStation
   * @returns the ChargingStationClient instance for the proper OCPP protocol
   * @memberof ChargingStationClient
   */
  static async getChargingStationClient(chargingStation) {
    const JsonRestChargingStationClient = require('./json/JsonRestChargingStationClient');
    let chargingClient = null;
    // Check protocol
    switch (chargingStation.getOcppProtocol()) {
      // JSON
      case Constants.OCPP_PROTOCOL_JSON:
        // Get the client from JSon Server
        if (global.centralSystemJson) {
          chargingClient = global.centralSystemJson.getChargingStationClient(chargingStation.getID());
        }
        // Not Found and deployed in Cloud Foundry?
        if (!chargingClient && Configuration.isCloudFoundry()) {
          // Use the remote client
          chargingClient = new JsonRestChargingStationClient(chargingStation);
        }
        break;
      // SOAP
      case Constants.OCPP_PROTOCOL_SOAP:
      default:
        // Get the Soap one by default
        const SoapChargingStationClient = require('./soap/SoapChargingStationClient');
        // Init client
        chargingClient = await new SoapChargingStationClient(chargingStation);
        break;
    }
    // Check
    if (!chargingClient) {
      throw new BackendError(chargingStation.getID(), "Client has not been found",
        "ChargingStationClient", "getChargingStationClient");
    }
    return chargingClient;
  }

  /**
   * Trigger a reset/reboot on a charging station
   *
   * @param {*} type
   * @memberof ChargingStationClient
   */
  reset(params) {
  }

  clearCache() {
  }

  getConfiguration(params) {
  }

  changeConfiguration(params) {
  }

  startTransaction(params) {
  }

  remoteStopTransaction(params) {
  }

  unlockConnector(params) {
  }
}

module.exports = ChargingStationClient;
