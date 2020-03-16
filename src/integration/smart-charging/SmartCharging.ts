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
    const chargingProfiles: ChargingProfile[] = await this.getChargingProfiles(siteArea);
    const results = [];

    console.log(chargingProfiles);

    for (const chargingProfile of chargingProfiles) {

      const chargingStation = await ChargingStationStorage.getChargingStation(this.tenantID, chargingProfile.id);
      // Get Vendor Instance
      const chargingStationVendor = ChargingStationVendorFactory.getChargingStationVendorInstance(chargingStation);
      // Set Charging Profile
      results.push(await chargingStationVendor.setChargingProfile(this.tenantID, chargingStation, chargingProfile));
    }

    // Get the factory
    // Call the charging plans
    // Apply the charging plans
    return results;
  }

  protected getSettings(): T {
    return this.setting;
  }

  async abstract getChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]>;


}
