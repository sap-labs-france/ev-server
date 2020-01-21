import { OCPPProtocol, OCPPVersion } from '../../types/ocpp/OCPPServer';
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

  getChargingStationService(ocppVersion: OCPPVersion): OCPPService {
    switch (ocppVersion) {
      case OCPPVersion.VERSION_12:
      case OCPPVersion.VERSION_15:
      case OCPPVersion.VERSION_16:
      default:
        if (!this.chargingStationService) {
          this.chargingStationService = new OCPPService(this.chargingStationConfig);
        }
        return this.chargingStationService;
    }
  }
}

