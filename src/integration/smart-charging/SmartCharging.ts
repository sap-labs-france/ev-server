/* eslint-disable @typescript-eslint/member-ordering */
import { ChargingProfile } from '../../types/ChargingProfile';
import { SmartChargingSetting } from '../../types/Setting';
import SiteArea from '../../types/SiteArea';
import { HTTPError } from '../../types/HTTPError';
import { Action } from '../../types/Authorization';
import AppError from '../../exception/AppError';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import Logging from '../../utils/Logging';

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

  public async computeAndApplyChargingProfiles(siteArea: SiteArea) {
    Logging.logDebug({
      tenantID: this.tenantID,
      source: siteArea.id,
      action: Action.CHARGING_PROFILE_UPDATE,
      message: 'Compute and Apply Charging Profiles is being called',
      module: 'SmartCharging', method: 'computeAndApplyChargingProfiles',
      detailedMessages: { siteArea }
    });

    // Call the charging plans
    const chargingProfiles: ChargingProfile[] = await this.getChargingProfiles(siteArea);
    if (!chargingProfiles) {
      throw new AppError({
        source: siteArea.id,
        action: Action.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        module: 'SmartCharging', method: 'computeAndApplyChargingProfiles',
        message: `No Charging Profiles available for Site Area: ${siteArea.name}`,
      });
    }
    // Apply the charging plans
    for (const chargingProfile of chargingProfiles) {
      try {
        // Set Charging Profile
        await OCPPUtils.applyAndSaveChargingProfile(this.tenantID, chargingProfile);
      } catch (error) {
        // If one fails clear every profile
        await OCPPUtils.clearAllChargingProfiles(this.tenantID, chargingProfiles);
        throw new AppError({
          source: siteArea.id,
          action: Action.CHARGING_PROFILE_UPDATE,
          errorCode: HTTPError.GENERAL_ERROR,
          module: 'SmartCharging', method: 'computeAndApplyChargingProfiles',
          message: `Setting Charging Profiles for Site Area: ${siteArea.name} failed`,
          detailedMessages: { error }
        });
      }
    }
  }
}
