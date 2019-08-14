import Constants from '../../utils/Constants';
import OCPPService from './services/OCPPService';

export default class CentralSystemServer {
  protected centralSystemConfig: any;
  protected chargingStationConfig: any;
  private chargingStationService: OCPPService;

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

  start() {
  }

  getChargingStationService(protocol): OCPPService {
    switch (protocol) {
      case Constants.OCPP_VERSION_12:
      case Constants.OCPP_VERSION_15:
      case Constants.OCPP_VERSION_16:
      default:
        if (!this.chargingStationService) {
          this.chargingStationService = new OCPPService(this.chargingStationConfig);
        }
        return this.chargingStationService;
    }
  }
}

