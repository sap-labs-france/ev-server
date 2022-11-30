import ChargingStation, { ChargePoint } from '../../../types/ChargingStation';

import { ChargingProfile } from '../../../types/ChargingProfile';
import ChargingStationVendorIntegration from '../ChargingStationVendorIntegration';
import { OCPPSetChargingProfileResponse } from '../../../types/ocpp/OCPPClient';
import Tenant from '../../../types/Tenant';

export default class WALLBOXChargingStationVendorIntegration extends ChargingStationVendorIntegration {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  // Wallbox only supports stack level 0
  public async setChargingProfile(tenant: Tenant, chargingStation: ChargingStation, chargePoint: ChargePoint,
      chargingProfile: ChargingProfile): Promise<OCPPSetChargingProfileResponse | OCPPSetChargingProfileResponse[]> {
    chargingProfile.profile.stackLevel = 0;
    return super.setChargingProfile(tenant, chargingStation, chargePoint, chargingProfile);
  }
}
