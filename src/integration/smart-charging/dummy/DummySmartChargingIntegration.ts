/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChargingProfile } from '../../../types/ChargingProfile';
import SiteArea from '../../../types/SiteArea';
import SmartChargingIntegration from '../SmartChargingIntegration';

export default class DummySapSmartChargingIntegration<SmartChargingSetting> extends SmartChargingIntegration<SmartChargingSetting> {
  constructor(tenantID: string, setting: SmartChargingSetting) {
    super(tenantID, setting);
  }

  public async buildChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]> {
    return null;
  }

  public async checkConnection() {
  }
}
