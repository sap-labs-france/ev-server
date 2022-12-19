import ChargingStation, { ChargerVendor } from '../../types/ChargingStation';

import ChargingStationVendorIntegration from './ChargingStationVendorIntegration';
import DefaultChargingStationVendorIntegration from './default/DefaultChargingStationVendorIntegration';
import EVBOXChargingStationVendorIntegration from './evbox/EVBOXChargingStationVendorIntegration';
import KebaChargingStationVendorIntegration from './keba/KebaChargingStationVendorIntegration';
import WALLBOXChargingStationVendorIntegration from './wallbox/WALLBOXChargingStationVendorIntegration';

export default class ChargingStationVendorFactory {
  public static getChargingStationVendorImpl(chargingStation: ChargingStation): ChargingStationVendorIntegration {
    let chargingStationVendorImpl: ChargingStationVendorIntegration = null;
    switch (chargingStation.chargePointVendor.toLowerCase()) {
      case ChargerVendor.EVBOX:
        chargingStationVendorImpl = new EVBOXChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.KEBA:
        chargingStationVendorImpl = new KebaChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.WALLBOX:
        chargingStationVendorImpl = new WALLBOXChargingStationVendorIntegration(chargingStation);
        break;
      default:
        chargingStationVendorImpl = new DefaultChargingStationVendorIntegration(chargingStation);
        break;
    }
    return chargingStationVendorImpl;
  }
}
