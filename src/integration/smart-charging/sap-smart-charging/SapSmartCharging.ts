import { ChargingProfile } from '../../../types/ChargingProfile';
import { SapSmartChargingSetting } from '../../../types/Setting';
import SiteArea from '../../../types/SiteArea';
import SmartCharging from '../SmartCharging';

export default class SapSmartCharging extends SmartCharging<SapSmartChargingSetting> {
  public constructor(tenantID: string, setting: SapSmartChargingSetting) {
    super(tenantID, setting);
  }

  public async getChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]> {
    // Optimizer implementation
    return null;
  }
}
