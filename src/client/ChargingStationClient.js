
class ChargingStationClient {
	constructor() {
		if (new.target === ChargingStationClient) {
			throw new TypeError("Cannot construct ChargingStationClient instances directly");
		}
	}
	
	static async getChargingStationClient(chargingStation) {
		let chargingClient = await global.centralWSServer.getChargingStationClient(chargingStation.getID());
		if (!chargingClient) {
			const SoapChargingStationClient = require('./soap/SoapChargingStationClient');
			// Init client
			chargingClient = await new SoapChargingStationClient(chargingStation);
		}
		return chargingClient;
	}

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
