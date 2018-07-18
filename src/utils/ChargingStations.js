const Constants = require('./Constants');
const AppError = require('../exception/AppError');
require('source-map-support').install();

module.exports = {
	WITH_CONNECTORS: true,
	WITHOUT_CONNECTORS: false,

	checkIfChargingStationValid(filteredRequest, request) {
		// Update mode?
		if(request.method !== "POST" && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The Charging Station ID is mandatory`,
				500, "ChargingStations", "checkIfChargingStationValid");
		}
	}
};
