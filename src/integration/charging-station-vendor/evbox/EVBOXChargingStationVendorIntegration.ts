import ChargingStation, { ChargePoint } from '../../../types/ChargingStation';

import ChargingStationVendorIntegration from '../ChargingStationVendorIntegration';
import { OCPPChangeConfigurationCommandResult } from '../../../types/ocpp/OCPPClient';

export default class EVBOXChargingStationVendorIntegration extends ChargingStationVendorIntegration {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  // EV-BOX use dA as unit for static limitation
  public async setStaticPowerLimitation(tenantID: string, chargingStation: ChargingStation,
    chargePoint?: ChargePoint, maxAmps?: number): Promise<OCPPChangeConfigurationCommandResult> {
    return super.setStaticPowerLimitation(tenantID, chargingStation, chargePoint, maxAmps, 10);
  }

  public async checkUpdateOfOCPPParams(tenantID: string, chargingStation: ChargingStation,
    ocppParamName: string, ocppParamValue: string): Promise<void> {
    return super.checkUpdateOfOCPPParams(tenantID, chargingStation, ocppParamName, ocppParamValue, 10);
  }
}
