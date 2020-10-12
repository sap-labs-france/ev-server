import ChargingStation, { ChargerVendor } from '../../types/ChargingStation';

import AbbChargingStationVendorIntegration from './abb/AbbChargingStationVendorIntegration';
import AtessChargingStationVendorIntegration from './atess/AtessChargingStationVendorIntegration';
import ChargingStationVendorIntegration from './ChargingStationVendorIntegration';
import DeltaChargingStationVendorIntegration from './delta/DeltaChargingStationVendorIntegration';
import EbeeChargingStationVendorIntegration from './ebee/EbeeChargingStationVendorIntegration';
import LegrandChargingStationVendorIntegration from './legrand/LegrandChargingStationVendorIntegration';
import SchneiderChargingStationVendorIntegration from './schneider/SchneiderChargingStationVendorIntegration';

export default class ChargingStationVendorFactory {

  static getChargingStationVendorImpl(chargingStation: ChargingStation): ChargingStationVendorIntegration {
    let chargingStationVendorImpl: ChargingStationVendorIntegration = null;
    switch (chargingStation.chargePointVendor) {
      case ChargerVendor.ABB:
        chargingStationVendorImpl = new AbbChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.SCHNEIDER:
        chargingStationVendorImpl = new SchneiderChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.EBEE:
      case ChargerVendor.BENDER:
      case ChargerVendor.WEBASTO:
      case ChargerVendor.MENNEKES:
        chargingStationVendorImpl = new EbeeChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.DELTA:
        chargingStationVendorImpl = new DeltaChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.LEGRAND:
        chargingStationVendorImpl = new LegrandChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.ATESS:
        chargingStationVendorImpl = new AtessChargingStationVendorIntegration(chargingStation);
        break;
    }
    return chargingStationVendorImpl;
  }
}
