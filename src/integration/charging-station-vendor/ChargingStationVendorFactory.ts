import ChargingStation, { ChargerVendor } from '../../types/ChargingStation';
import ChargingStationVendor from './ChargingStationVendor';
import DeltaChargingStationVendor from './delta/DeltaChargingStationVendor';
import SchneiderChargingStationVendor from './schneider/SchneiderChargingStationVendor';
import WebastoChargingStationVendor from './webasto/WebastoChargingStationVendor';

export default class ChargingStationVendorFactory {

  static getChargingStationVendorInstance(chargingStation: ChargingStation): ChargingStationVendor {
    switch (chargingStation.chargePointVendor) {
      // Schneider
      case ChargerVendor.SCHNEIDER:
        return new SchneiderChargingStationVendor(chargingStation);
      // Webasto
      case ChargerVendor.WEBASTO:
        return new WebastoChargingStationVendor(chargingStation);
      // Delta
      case ChargerVendor.DELTA:
        return new DeltaChargingStationVendor(chargingStation);
    }
    return null;
  }
}
