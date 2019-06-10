require('source-map-support').install();
import OCPPService from './services/OCPPService';
import Constants from '../../utils/Constants';

/**
 * Main interface for starting servers
 *
 * @class CentralSystemServer
 */export default class CentralSystemServer {
  protected centralSystemConfig: any;
  protected chargingStationConfig: any;
  private chargingStationService: any;
  // Common constructor for Central System Server
  constructor(centralSystemConfig, chargingStationConfig) {
    // Check
    if (new.target === CentralSystemServer) {
      throw new TypeError('Cannot construct CentralSystemServer instances directly');
    }
    // Init
    this.centralSystemConfig = centralSystemConfig;
    this.chargingStationConfig = chargingStationConfig;
    this.chargingStationService = null;
  }

  /**
	 * Starting the server ==> Implemented in sub classes
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
        if (!this.chargingStationService) {
          // OCCP 1.6 handles all protocols from 1.2 to 1.6
          this.chargingStationService = new OCPPService(this.centralSystemConfig, this.chargingStationConfig);
        }
        return this.chargingStationService;
    }
  }
}


