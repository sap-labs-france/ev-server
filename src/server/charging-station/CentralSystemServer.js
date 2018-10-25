require('source-map-support').install();

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
