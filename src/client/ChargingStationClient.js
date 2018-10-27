
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
    // Try to get the JSON Client first 
    if (global.centralSystemJson) {
      // Get the client from JSon Server
      chargingClient = await global.centralSystemJson.getChargingStationClient(chargingStation.getID());
    }
    // Not Found?
    if (!chargingClient) {
      // Get the Soap one by default
      const SoapChargingStationClient = require('./soap/SoapChargingStationClient');
      // Init client
      chargingClient = await new SoapChargingStationClient(chargingStation);
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
