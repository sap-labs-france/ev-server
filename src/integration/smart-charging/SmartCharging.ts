import { ChargingProfile } from '../../types/ChargingProfile';
import { SmartChargingSetting } from '../../types/Setting';
import SiteArea from '../../types/SiteArea';

export default abstract class SmartCharging<T extends SmartChargingSetting> {
  protected readonly tenantID: string;
  protected readonly setting: T;

  protected constructor(tenantID: string, setting: T) {
    this.tenantID = tenantID;
    this.setting = setting;
  }

  async abstract getChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]>;

  protected getSettings(): T {
    return this.setting;
  }
}
