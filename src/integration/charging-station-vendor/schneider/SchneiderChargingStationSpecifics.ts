import ChargingStation, { ChargingProfile } from '../../../types/ChargingStation';
import ChargingStationVendor from '../ChargingStationVendor';


export default class SchneiderChargingStationVendor extends ChargingStationVendor {
  constructor(chargingStation: ChargingStation) {
    super(chargingStation);
  }

  public setStaticLimitation(tenantID: string, chargingStation: ChargingStation, maxAmps: number, connectorID?: number) {
    throw new Error('Method not implemented.');
  }

  public setChargingProfile(tenantID: string, chargingStation: ChargingStation, chargingProfile: ChargingProfile) {
    throw new Error('Method not implemented.');
  }
}
