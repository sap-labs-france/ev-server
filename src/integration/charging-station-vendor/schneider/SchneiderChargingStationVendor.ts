
import ChargingStation from '../../../types/ChargingStation';
import ChargingStationVendor from '../ChargingStationVendor';

export default class SchneiderChargingStationVendor extends ChargingStationVendor {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  public getOCPPParamNameForChargingLimitation(): string {
    return 'maxintensitysocket';
  }
}
