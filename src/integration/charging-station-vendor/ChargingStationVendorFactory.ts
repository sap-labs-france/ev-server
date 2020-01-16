import ChargingStation from '../../types/ChargingStation';
import Constants from '../../utils/Constants';
import ChargingStationVendor from './ChargingStationVendor';
import SchneiderChargingStationVendor from './schneider/SchneiderChargingStationSpecifics';

export default class ChargingStationVendorFactory {

  static async getChargingStationVendorInstance(chargingStation: ChargingStation): Promise<ChargingStationVendor> {
    switch (chargingStation.chargePointVendor) {
      // Schneider
      case Constants.VENDOR_SCHNEIDER:
        return new SchneiderChargingStationVendor(chargingStation);
    }
    return null;
  }
}
