
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
		// by default try to get the JSON client
		let chargingClient = await global.centralWSServer.getChargingStationClient(chargingStation.getID());
		if (!chargingClient) { // not a JSON client
			if (!chargingStation._chargingStationClient) { // not assigned yet so take a new SOAP client
				const SoapChargingStationClient = require('./soap/SoapChargingStationClient');
				// Init client
				chargingClient = await new SoapChargingStationClient(chargingStation);
			} else {
				chargingClient = chargingStation._chargingStationClient;
			}
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
