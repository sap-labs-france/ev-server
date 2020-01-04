import ChargingStation from '../../types/ChargingStation';
import ChargingStationSpecifics from './ChargingStationSpecifics';
import Constants from '../../utils/Constants';
import SchneiderChargingStationSpecifics from './schneider/SchneiderChargingStationSpecifics';

export default class ChargingStationSpecificsFactory {

  static async getChargingStationSpecificsInstance(chargingStation: ChargingStation): Promise<ChargingStationSpecifics> {
    switch (chargingStation.chargePointVendor) {
      // Schneider
      case Constants.VENDOR_SCHNEIDER:
        return new SchneiderChargingStationSpecifics(chargingStation);
    }
    return null;
  }
}
