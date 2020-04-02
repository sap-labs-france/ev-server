import BackendError from '../../exception/BackendError';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import { Action } from '../../types/Authorization';
import { ChargingProfile } from '../../types/ChargingProfile';
import { SmartChargingSetting } from '../../types/Setting';
import SiteArea from '../../types/SiteArea';
import Logging from '../../utils/Logging';

export default abstract class SmartCharging<T extends SmartChargingSetting> {
  protected readonly tenantID: string;
  protected readonly setting: T;

  protected constructor(tenantID: string, setting: T) {
    this.tenantID = tenantID;
    this.setting = setting;
  }

  public async computeAndApplyChargingProfiles(siteArea: SiteArea) {
    Logging.logDebug({
      tenantID: this.tenantID,
      action: Action.CHARGING_PROFILE_UPDATE,
      message: 'Compute and Apply Charging Profiles is being called',
      module: 'SmartCharging', method: 'computeAndApplyChargingProfiles',
      detailedMessages: { siteArea }
    });
    // Call the charging plans
    const chargingProfiles: ChargingProfile[] = await this.buildChargingProfiles(siteArea);
    if (!chargingProfiles) {
      throw new BackendError({
        action: Action.CHARGING_PROFILE_UPDATE,
        module: 'SmartCharging', method: 'computeAndApplyChargingProfiles',
        message: `No Charging Profiles have been built for Site Area: ${siteArea.name}`,
      });
    }
    // Apply the charging plans
    for (const chargingProfile of chargingProfiles) {
      try {
        // Set Charging Profile
        await OCPPUtils.setAndSaveChargingProfile(this.tenantID, chargingProfile);
      } catch (error) {
        // Log failed
        Logging.logError({
          tenantID: this.tenantID,
          source: chargingProfile.chargingStationID,
          action: Action.CHARGING_PROFILE_UPDATE,
          module: 'SmartCharging', method: 'computeAndApplyChargingProfiles',
          message: `Setting Charging Profiles for Site Area: ${siteArea.name} failed`,
          detailedMessages: { error }
        });
      }
    }
    Logging.logDebug({
      tenantID: this.tenantID,
      action: Action.CHARGING_PROFILE_UPDATE,
      message: 'Compute and Apply Charging Profiles has been called',
      module: 'SmartCharging', method: 'computeAndApplyChargingProfiles'
    });
  }

  protected getSettings(): T {
    return this.setting;
  }

  async abstract buildChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]>;

  async abstract checkConnection(): Promise<any>;

}
