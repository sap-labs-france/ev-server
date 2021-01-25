import ChargingStation, { ChargerVendor } from '../../types/ChargingStation';

import AbbChargingStationVendorIntegration from './abb/AbbChargingStationVendorIntegration';
import AtessChargingStationVendorIntegration from './atess/AtessChargingStationVendorIntegration';
import ChargingStationVendorIntegration from './ChargingStationVendorIntegration';
import DefaultChargingStationVendorIntegration from './default/DefaultChargingStationVendorIntegration';
import DeltaChargingStationVendorIntegration from './delta/DeltaChargingStationVendorIntegration';
import EVBOXChargingStationVendorIntegration from './evbox/EVBOXChargingStationVendorIntegration';
import EbeeChargingStationVendorIntegration from './ebee/EbeeChargingStationVendorIntegration';
import IESChargingStationVendorIntegration from './ies/IESChargingStationVendorIntegration';
import InnogyChargingStationVendorIntegration from './innogy/InnogyChargingStationVendorIntegration';
import KebaChargingStationVendorIntegration from './keba/KebaChargingStationVendorIntegration';
import LegrandChargingStationVendorIntegration from './legrand/LegrandChargingStationVendorIntegration';
import SAPLabsFranceChargingStationVendorIntegration from './sap/SAPLabsFranceChargingStationVendorIntegration';
import SchneiderChargingStationVendorIntegration from './schneider/SchneiderChargingStationVendorIntegration';
import WallboxChargersChargingStationVendorIntegration from './wallboxchargers/WallboxChargersChargingStationVendorIntegration';

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
      case ChargerVendor.EVBOX:
        chargingStationVendorImpl = new EVBOXChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.INNOGY:
        chargingStationVendorImpl = new InnogyChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.IES:
        chargingStationVendorImpl = new IESChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.WALLBOX_CHARGERS:
        chargingStationVendorImpl = new WallboxChargersChargingStationVendorIntegration(chargingStation);
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
      case ChargerVendor.KEBA:
        chargingStationVendorImpl = new KebaChargingStationVendorIntegration(chargingStation);
        break;
      case ChargerVendor.SAP_LABS_FRANCE:
        chargingStationVendorImpl = new SAPLabsFranceChargingStationVendorIntegration(chargingStation);
        break;
      // FIXME: adding a default vendor class to only require a vendor class when existing methods need adaptation needs more work
      // default:
      //   chargingStationVendorImpl = new DefaultChargingStationVendorIntegration(chargingStation);
      //   break;
    }
    return chargingStationVendorImpl;
  }
}
