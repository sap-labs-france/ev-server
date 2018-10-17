const ChargingStation = require('../../model/ChargingStation');
const AppError = require('../../exception/AppError');
const Logging = require('../../utils/Logging');
const Configuration = require('../../utils/Configuration');
require('source-map-support').install();

let _centralSystemConfig;
let _chargingStationConfig;

/**
 * Main interface for starting servers
 *
 * @class CentralSystemServer
 */
class CentralSystemServer {
	// Common constructor for Central System Server
	constructor(centralSystemConfig, chargingStationConfig) {
		// Check
		if (new.target === CentralSystemServer) {
			throw new TypeError('Cannot construct CentralSystemServer instances directly');
		}

		// Keep params
		_centralSystemConfig = centralSystemConfig;
		_chargingStationConfig = chargingStationConfig;
	}


	/**
	 * Starting the server==> Implemented in sub classes
	 *
	 * @memberof CentralSystemServer
	 */
	start() {
	}
}

module.exports = CentralSystemServer;
