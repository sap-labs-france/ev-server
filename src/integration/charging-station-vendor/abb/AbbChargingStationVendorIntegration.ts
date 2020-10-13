import ChargingStation from '../../../types/ChargingStation';
import ChargingStationVendorIntegration from '../ChargingStationVendorIntegration';

export default class AbbChargingStationVendorIntegration extends ChargingStationVendorIntegration {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }
}
