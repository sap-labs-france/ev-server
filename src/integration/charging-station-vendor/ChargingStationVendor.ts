import { ChargingProfile } from '../../types/ChargingProfile';
import ChargingStation from '../../types/ChargingStation';

export default abstract class ChargingStationVendor {
  protected chargingStation: ChargingStation;

  constructor(chargingStation: ChargingStation) {
    this.chargingStation = chargingStation;
  }

  public abstract async setPowerLimitation(tenantID: string, chargingStation: ChargingStation, connectorID?: number, maxAmps?: number);

  public abstract async checkUpdateOfOCPPParams(tenantID: string, chargingStation: ChargingStation, ocppParamName: string, ocppParamValue);

  public abstract async setChargingProfile(tenantID: string, chargingStation: ChargingStation, chargingProfile: ChargingProfile);
}
