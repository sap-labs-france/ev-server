/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChargingProfile } from '../../../types/ChargingProfile';
import SiteArea from '../../../types/SiteArea';
import SmartChargingIntegration from '../SmartChargingIntegration';
import Tenant from '../../../types/Tenant';

export default class DummySapSmartChargingIntegration<SmartChargingSetting> extends SmartChargingIntegration<SmartChargingSetting> {
  constructor(tenant: Tenant, setting: SmartChargingSetting) {
    super(tenant, setting);
  }

  public async buildChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]> {
    return null;
  }

  public async checkConnection() {
  }
}
