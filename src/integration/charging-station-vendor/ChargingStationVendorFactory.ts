import ChargingStation, { ChargerVendor } from '../../types/ChargingStation';
import ChargingStationVendor from './ChargingStationVendor';
import SchneiderChargingStationVendor from './schneider/SchneiderChargingStationVendor';

export default class ChargingStationVendorFactory {

  static getChargingStationVendorInstance(chargingStation: ChargingStation): ChargingStationVendor {
    switch (chargingStation.chargePointVendor) {
      // Schneider
      case ChargerVendor.SCHNEIDER:
        return new SchneiderChargingStationVendor(chargingStation);
    }
    return null;
  }
}
