import ChargingStation, { ChargerVendor } from '../../types/ChargingStation';

import ChargingStationVendorIntegration from './ChargingStationVendorIntegration';
import DeltaChargingStationVendorIntegration from './delta/DeltaChargingStationVendorIntegration';
import SchneiderChargingStationVendorIntegration from './schneider/SchneiderChargingStationVendorIntegration';
import WebastoChargingStationVendorIntegration from './webasto/WebastoChargingStationVendorIntegration';

export default class ChargingStationVendorFactory {

  static getChargingStationVendorImpl(chargingStation: ChargingStation): ChargingStationVendorIntegration {
    let chargingStationVendorImpl;
    switch (chargingStation.chargePointVendor) {
      // Schneider
      case ChargerVendor.SCHNEIDER:
        chargingStationVendorImpl = new SchneiderChargingStationVendorIntegration(chargingStation);
        break;
      // Webasto
      case ChargerVendor.WEBASTO:
        chargingStationVendorImpl = new WebastoChargingStationVendorIntegration(chargingStation);
        break;
      // Delta
      case ChargerVendor.DELTA:
        chargingStationVendorImpl = new DeltaChargingStationVendorIntegration(chargingStation);
        break;
      default:
        chargingStationVendorImpl = null;
        break;
    }
    return chargingStationVendorImpl;
  }
}
