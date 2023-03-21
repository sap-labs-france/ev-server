import { ActionsResponse } from '../../types/GlobalType';
import BackendError from '../../exception/BackendError';
import { ChargingProfile } from '../../types/ChargingProfile';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import { SmartChargingSetting } from '../../types/Setting';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import { Voltage } from '../../types/ChargingStation';

const MODULE_NAME = 'SmartChargingIntegration';

export default abstract class SmartChargingIntegration<T extends SmartChargingSetting> {
  protected readonly tenant: Tenant;
  protected readonly setting: T;
  private excludedChargingStations: string[] = [];

  protected constructor(tenant: Tenant, setting: T) {
    this.tenant = tenant;
    this.setting = setting;
  }

  public async computeAndApplyChargingProfiles(siteArea: SiteArea, retry = false): Promise<ActionsResponse> {
    const actionsResponse: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Call the charging plans
    const chargingProfiles: ChargingProfile[] = await this.buildChargingProfiles(siteArea, this.excludedChargingStations);
    if (!chargingProfiles) {
      await Logging.logInfo({
        tenantID: this.tenant.id,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'computeAndApplyChargingProfiles',
        message: `No Charging Profiles have been built for Site Area '${siteArea.name}'`,
      });
      return;
    }
    // Sort charging profiles
    // Lower limits need to be set first. (When high limit is set first, it may appear that the corresponding low limit is not set yet)
    chargingProfiles.sort((a, b) => a.profile.chargingSchedule.chargingSchedulePeriod[0].limit - b.profile.chargingSchedule.chargingSchedulePeriod[0].limit);
    // Apply the charging plans
    for (const chargingProfile of chargingProfiles) {
      try {
        // Set Charging Profile
        await OCPPUtils.setAndSaveChargingProfile(this.tenant, chargingProfile);
        actionsResponse.inSuccess++;
      } catch (error) {
        // Retry setting the profile and check if succeeded
        if (await this.handleRefusedChargingProfile(this.tenant, chargingProfile, siteArea.name)) {
          actionsResponse.inSuccess++;
          continue;
        }
        actionsResponse.inError++;
        await Logging.logError({
          tenantID: this.tenant.id,
          siteID: chargingProfile.chargingStation.siteID,
          siteAreaID: chargingProfile.chargingStation.siteAreaID,
          companyID: chargingProfile.chargingStation.companyID,
          chargingStationID: chargingProfile.chargingStationID,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          module: MODULE_NAME, method: 'computeAndApplyChargingProfiles',
          message: `Setting Charging Profiles for Site Area '${siteArea.name}' failed, because of  '${chargingProfile.chargingStationID}'. It has been excluded from this smart charging run automatically`,
          detailedMessages: { error: error.stack }
        });
      }
    }
    // Log
    await Logging.logActionsResponse(this.tenant.id, ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
      MODULE_NAME, 'computeAndApplyChargingProfiles', actionsResponse,
      '{{inSuccess}} charging plan(s) were successfully pushed',
      '{{inError}} charging plan(s) failed to be pushed',
      '{{inSuccess}} charging plan(s) were successfully pushed and {{inError}} failed to be pushed',
      'No charging plans have been pushed'
    );
    if (actionsResponse.inError > 0 && retry === false) {
      await this.computeAndApplyChargingProfiles(siteArea, retry = true);
    }
    return actionsResponse;
  }

  protected checkIfSiteAreaIsValid(siteArea: SiteArea): void {
    if (!siteArea.maximumPower) {
      throw new BackendError({
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'checkIfSiteAreaIsValid',
        message: `Maximum Power is not set in Site Area '${siteArea.name}'`
      });
    }
    if (siteArea.voltage !== Voltage.VOLTAGE_230 && siteArea.voltage !== Voltage.VOLTAGE_110) {
      throw new BackendError({
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'checkIfSiteAreaIsValid',
        message: `Voltage must be either 110V or 230V in Site Area '${siteArea.name}'`
      });
    }
    if (siteArea.numberOfPhases !== 1 && siteArea.numberOfPhases !== 3) {
      throw new BackendError({
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'checkIfSiteAreaIsValid',
        message: `Number of phases must be either 1 or 3 in Site Area '${siteArea.name}'`
      });
    }
  }

  private async handleRefusedChargingProfile(tenant: Tenant, chargingProfile: ChargingProfile, siteAreaName: string): Promise<boolean> {
    // Retry setting the cp 2 more times
    for (let i = 0; i < 2; i++) {
      try {
        // Set Charging Profile
        await OCPPUtils.setAndSaveChargingProfile(this.tenant, chargingProfile);
        return true;
      } catch (error) {
        // Log failed
        await Logging.logError({
          tenantID: this.tenant.id,
          siteID: chargingProfile.chargingStation.siteID,
          siteAreaID: chargingProfile.chargingStation.siteAreaID,
          companyID: chargingProfile.chargingStation.companyID,
          chargingStationID: chargingProfile.chargingStationID,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          module: MODULE_NAME, method: 'handleRefusedChargingProfile',
          message: 'Setting Charging Profiles failed 3 times.',
          detailedMessages: { error: error.stack }
        });
      }
    }
    // Remove Charging Station from Smart Charging
    const chargingStation = await ChargingStationStorage.getChargingStation(tenant, chargingProfile.chargingStationID);
    // Remember Charging Stations which were removed from Smart Charging
    this.excludedChargingStations.push(chargingStation.id);
    // Notify Admins
    NotificationHandler.sendComputeAndApplyChargingProfilesFailed(tenant, chargingStation,
      { chargeBoxID: chargingProfile.chargingStationID,
        siteID: chargingProfile.chargingStation?.siteID,
        siteAreaID: chargingProfile.chargingStation?.siteAreaID,
        companyID: chargingProfile.chargingStation?.companyID,
        siteAreaName: siteAreaName,
        evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
      }
    ).catch((error) => {
      Logging.logPromiseError(error, tenant?.id);
    });
    return false;
  }

  public abstract buildChargingProfiles(siteArea: SiteArea, excludedChargingStations?: string[]): Promise<ChargingProfile[]>;

  public abstract checkConnection(): Promise<void>;
}
