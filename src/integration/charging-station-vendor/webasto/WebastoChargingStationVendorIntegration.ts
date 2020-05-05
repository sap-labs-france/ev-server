
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationVendorIntegration from '../ChargingStationVendorIntegration';

export default class WebastoChargingStationVendorIntegration extends ChargingStationVendorIntegration {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  public getOCPPParamNameForChargingLimitation(): string {
    return 'OperatorCurrentLimit';
  }
}
