import ChargingStation, { ChargerVendor } from '../../types/ChargingStation';
import ChargingStationVendor from './ChargingStationVendor';
import SchneiderChargingStationVendor from './schneider/SchneiderChargingStationSpecifics';

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
