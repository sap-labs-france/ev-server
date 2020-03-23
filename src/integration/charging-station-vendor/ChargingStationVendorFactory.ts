import ChargingStation, { ChargerVendor } from '../../types/ChargingStation';
import ChargingStationVendor from './ChargingStationVendor';
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
    }
    return null;
  }
}
