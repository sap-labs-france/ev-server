const Constants = require('../utils/Constants');
const Configuration = require('../utils/Configuration');
const RemoteJsonChargingStationClient = require('./json/RemoteJsonChargingStationClient');

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
    let chargingClient = null;
    // Check protocol
    switch (chargingStation.getOcppProtocol()) {
      // JSON
      case Constants.OCPP_PROTOCOL_JSON:
        // Get the client from JSon Server
        chargingClient = await global.centralSystemJson.getChargingStationClient(chargingStation.getID());
        // Cloud Foundry?
        if (!chargingClient && Configuration.isCloudFoundry()) {
          // Use the remote client
          chargingClient = new RemoteJsonChargingStationClient(chargingStation);
          // Init
          await chargingClient.initialize();
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
    return chargingClient;
	}

	/**
	 * triffer a reset/reboot on a charging station
	 *
	 * @param {*} type
	 * @memberof ChargingStationClient
	 */
	reset(type) {
	}

	clearCache() {
	}

	getConfiguration(keys) {
	}

	changeConfiguration(key, value) {
	}

	startTransaction(tagID, connectorID) {
	}

	stopTransaction(transactionId) {
	}

	unlockConnector(connectorId) {
	}
}

module.exports = ChargingStationClient;
