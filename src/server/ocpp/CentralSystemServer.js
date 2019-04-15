require('source-map-support').install();
const OCPPService = require('./services/OCPPService');
const Constants = require('../../utils/Constants');

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
    // Init
    this._centralSystemConfig = centralSystemConfig;
    this._chargingStationConfig = chargingStationConfig;
    this._chargingStationService = null;
  }


  /**
	 * Starting the server==> Implemented in sub classes
	 *
	 * @memberof CentralSystemServer
	 */
  start() {
  }

  /**
   * Get the service that will handle the Charger's requests
   * 
	 * @param protocol: string containing protocol version 1.2 || 1.5 || 1.6
	 * @memberof CentralSystemServer
	 */
  getChargingStationService(protocol) {
    switch (protocol) {
      case Constants.OCPP_VERSION_12:
      case Constants.OCPP_VERSION_15:
      case Constants.OCPP_VERSION_16:
      default:
        if (!this._chargingStationService) {
          // OCCP 1.6 handles all protocols from 1.2 to 1.6
          this._chargingStationService = new OCPPService(this._centralSystemConfig, this._chargingStationConfig);
        }
        return this._chargingStationService;
    }
  }
}

module.exports = CentralSystemServer;
