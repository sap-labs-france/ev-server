import { ChargingProfile } from '../../types/ChargingProfile';
import ChargingStation, { ConnectorCurrentLimit } from '../../types/ChargingStation';
import { OCPPSetCompositeScheduleStatus } from '../../types/ocpp/OCPPClient';

export default abstract class ChargingStationVendor {
  protected chargingStation: ChargingStation;

  constructor(chargingStation: ChargingStation) {
    this.chargingStation = chargingStation;
  }

  public abstract async setPowerLimitation(tenantID: string, chargingStation: ChargingStation, connectorID?: number, maxAmps?: number);

  public abstract async checkUpdateOfOCPPParams(tenantID: string, chargingStation: ChargingStation, ocppParamName: string, ocppParamValue);

  public abstract async setChargingProfile(tenantID: string, chargingStation: ChargingStation, chargingProfile: ChargingProfile): Promise<OCPPSetCompositeScheduleStatus>;

  public async getConnectorLimit(tenantID: string, chargingStation: ChargingStation, connectorID: number): Promise<ConnectorCurrentLimit> {
    return {
      limitAmps: chargingStation.connectors[connectorID-1].amperageLimit,
      limitWatts: chargingStation.connectors[connectorID-1].power
    }
  }
}
