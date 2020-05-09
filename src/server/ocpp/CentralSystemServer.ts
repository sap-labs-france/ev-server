import CentralSystemConfiguration from '../../types/configuration/CentralSystemConfiguration';
import ChargingStationConfiguration from '../../types/configuration/ChargingStationConfiguration';
import OCPPService from './services/OCPPService';
import { OCPPVersion } from '../../types/ocpp/OCPPServer';

export default class CentralSystemServer {
  protected centralSystemConfig: CentralSystemConfiguration;
  protected chargingStationConfig: ChargingStationConfiguration;
  private chargingStationService: OCPPService;

  // Common constructor for Central System Server
  constructor(centralSystemConfig: CentralSystemConfiguration, chargingStationConfig: ChargingStationConfiguration) {
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

