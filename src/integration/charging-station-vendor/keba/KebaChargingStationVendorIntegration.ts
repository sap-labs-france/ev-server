import ChargingStation, { ChargePoint } from '../../../types/ChargingStation';

import ChargingStationVendorIntegration from '../ChargingStationVendorIntegration';
import { OCPPChangeConfigurationCommandResult } from '../../../types/ocpp/OCPPClient';
import Tenant from '../../../types/Tenant';

export default class KebaChargingStationVendorIntegration extends ChargingStationVendorIntegration {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  // Keba use mA as unit for static limitation
  public async setStaticPowerLimitation(tenant: Tenant, chargingStation: ChargingStation,
      chargePoint?: ChargePoint, maxAmps?: number): Promise<OCPPChangeConfigurationCommandResult> {
    return super.setStaticPowerLimitation(tenant, chargingStation, chargePoint, maxAmps, 1000);
  }

  public async checkUpdateOfOCPPParams(tenant: Tenant, chargingStation: ChargingStation,
      ocppParamName: string, ocppParamValue: string): Promise<void> {
    return super.checkUpdateOfOCPPParams(tenant, chargingStation, ocppParamName, ocppParamValue, 1000);
  }
}
