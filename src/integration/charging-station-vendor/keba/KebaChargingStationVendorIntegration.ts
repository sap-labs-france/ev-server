import ChargingStation, { ChargePoint } from '../../../types/ChargingStation';

import ChargingStationVendorIntegration from '../ChargingStationVendorIntegration';
import { OCPPChangeConfigurationCommandResult } from '../../../types/ocpp/OCPPClient';

export default class KebaChargingStationVendorIntegration extends ChargingStationVendorIntegration {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  // Keba use mA as unit for static limitation
  public async setStaticPowerLimitation(tenantID: string, chargingStation: ChargingStation,
    chargePoint?: ChargePoint, maxAmps?: number): Promise<OCPPChangeConfigurationCommandResult> {
    return super.setStaticPowerLimitation(tenantID, chargingStation, chargePoint, maxAmps, 1000);
  }

  public async checkUpdateOfOCPPParams(tenantID: string, chargingStation: ChargingStation,
    ocppParamName: string, ocppParamValue: string): Promise<void> {
    return super.checkUpdateOfOCPPParams(tenantID, chargingStation, ocppParamName, ocppParamValue, 1000);
  }
}
