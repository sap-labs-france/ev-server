import { ChargingProfile } from '../../types/ChargingProfile';
import { SmartChargingSetting } from '../../types/Setting';
import SiteArea from '../../types/SiteArea';
import { HTTPError } from '../../types/HTTPError';
import { Action } from '../../types/Authorization';
import ChargingStationVendorFactory from '../charging-station-vendor/ChargingStationVendorFactory';
import ChargingStation from '../../types/ChargingStation';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import AppError from '../../exception/AppError';

export default abstract class SmartCharging<T extends SmartChargingSetting> {
  protected readonly tenantID: string;
  protected readonly setting: T;

  protected constructor(tenantID: string, setting: T) {
    this.tenantID = tenantID;
    this.setting = setting;
  }


  public async computeAndApplyChargingProfiles(siteArea: SiteArea) {
    // Call the charging plans
    const chargingProfiles: ChargingProfile[] = await this.getChargingProfiles(siteArea);
    if (!chargingProfiles) {
      throw new AppError({
        source: siteArea.id,
        action: Action.CHARGING_PROFILE_UPDATE,
        errorCode: HTTPError.GENERAL_ERROR,
        module: 'SmartCharging', method: 'computeAndApplyChargingProfiles',
        message: `No Charging Profiles for Site Area "${siteArea.id}"`,
      });
    }
    // Apply the charging plans
    for (const chargingProfile of chargingProfiles) {
      const chargingStation = await ChargingStationStorage.getChargingStation(this.tenantID, chargingProfile.chargingStationID);
      // Get Vendor Instance
      const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorInstance(chargingStation);
      if (!chargingStationVendor) {
        throw new AppError({
          source: chargingStation.id,
          action: Action.CHARGING_PROFILE_UPDATE,
          errorCode: HTTPError.FEATURE_NOT_SUPPORTED_ERROR,
          module: 'SmartCharging', method: 'computeAndApplyChargingProfiles',
          message: `No vendor implementation is available (${chargingStation.chargePointVendor}) for setting a Charging Profile`,
        });
      }
      // Setting Profiles Success variable
      let success = true;
      try {
        // Set Charging Profile
        await chargingStationVendor.setChargingProfile(this.tenantID, chargingStation, chargingProfile);
      } catch (error) {
        success = false;
      }
      if (!success) {
        await chargingStationVendor.clearAllChargingProfiles(this.tenantID, chargingStation, chargingProfiles);
      }
    }
  }

  protected getSettings(): T {
    return this.setting;
  }

  async abstract getChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]>;


}
