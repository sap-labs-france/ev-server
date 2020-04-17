
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationVendor from '../ChargingStationVendor';

export default class DeltaChargingStationVendor extends ChargingStationVendor {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  public getOCPPParamNameForChargingLimitation(): string {
    return 'GridCurrent';
  }
}
