import ChargingStation from '../../../types/ChargingStation';
import ChargingStationVendorIntegration from '../ChargingStationVendorIntegration';

export default class EbeeChargingStationVendorIntegration extends ChargingStationVendorIntegration {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }
}
