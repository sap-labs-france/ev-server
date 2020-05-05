import ChargingStation, { ChargerVendor } from '../../types/ChargingStation';

import ChargingStationVendorIntegration from './ChargingStationVendorIntegration';
import DeltaChargingStationVendorIntegration from './delta/DeltaChargingStationVendorIntegration';
import SchneiderChargingStationVendorIntegration from './schneider/SchneiderChargingStationVendorIntegration';
import WebastoChargingStationVendorIntegration from './webasto/WebastoChargingStationVendorIntegration';

export default class ChargingStationVendorFactory {

  static getChargingStationVendorImpl(chargingStation: ChargingStation): ChargingStationVendorIntegration {
    switch (chargingStation.chargePointVendor) {
      // Schneider
      case ChargerVendor.SCHNEIDER:
        return new SchneiderChargingStationVendorIntegration(chargingStation);
      // Webasto
      case ChargerVendor.WEBASTO:
        return new WebastoChargingStationVendorIntegration(chargingStation);
      // Delta
      case ChargerVendor.DELTA:
        return new DeltaChargingStationVendorIntegration(chargingStation);
    }
    return null;
  }
}
