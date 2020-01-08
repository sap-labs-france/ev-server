import ChargingStation, { ChargingProfile } from '../../types/ChargingStation';

export default abstract class ChargingStationSpecifics {
  protected chargingStation: ChargingStation;

  constructor(chargingStation: ChargingStation) {
    this.chargingStation = chargingStation;
  }

  public abstract setStaticLimitation(tenantID: string, chargingStation: ChargingStation, maxAmps: number, connectorID?: number);

  public abstract setChargingProfile(tenantID: string, chargingStation: ChargingStation, chargingProfile: ChargingProfile);
}
