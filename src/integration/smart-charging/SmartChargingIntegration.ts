import { ActionsResponse } from '../../types/GlobalType';
import BackendError from '../../exception/BackendError';
import { ChargingProfile } from '../../types/ChargingProfile';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import { SmartChargingSetting } from '../../types/Setting';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SmartChargingIntegration';

export default abstract class SmartChargingIntegration<T extends SmartChargingSetting> {
  protected readonly tenantID: string;
  protected readonly setting: T;

  protected constructor(tenantID: string, setting: T) {
    this.tenantID = tenantID;
    this.setting = setting;
  }

  public async computeAndApplyChargingProfiles(siteArea: SiteArea, retry = false): Promise<ActionsResponse> {
    const actionsResponse: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    // Call the charging plans
    const chargingProfiles: ChargingProfile[] = await this.buildChargingProfiles(siteArea);
    if (!chargingProfiles) {
      Logging.logInfo({
        tenantID: this.tenantID,
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'computeAndApplyChargingProfiles',
        message: `No Charging Profiles have been built for Site Area '${siteArea.name}'`,
      });
      return;
    }
    // Apply the charging plans
    for (const chargingProfile of chargingProfiles) {
      try {
        // Set Charging Profile
        await OCPPUtils.setAndSaveChargingProfile(this.tenantID, chargingProfile);
        actionsResponse.inSuccess++;
      } catch (error) {
        // Retry setting the profile and check if succeeded
        if (await this.handleRefusedChargingProfile(this.tenantID, chargingProfile, siteArea.name)) {
          actionsResponse.inSuccess++;
          continue;
        }
        actionsResponse.inError++;
        // Log failed
        Logging.logError({
          tenantID: this.tenantID,
          source: chargingProfile.chargingStationID,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          module: MODULE_NAME, method: 'computeAndApplyChargingProfiles',
          message: `Setting Charging Profiles for Site Area '${siteArea.name}' failed, because of  '${chargingProfile.chargingStationID}'. It has been excluded from smart charging automatically`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Log
    Utils.logActionsResponse(this.tenantID, ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
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
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'checkIfSiteAreaIsValid',
        message: `Maximum Power is not set in Site Area '${siteArea.name}'`
      });
    }
    if (siteArea.voltage !== 230 && siteArea.voltage !== 110) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'checkIfSiteAreaIsValid',
        message: `Voltage must be either 110V or 230V in Site Area '${siteArea.name}'`
      });
    }
    if (siteArea.numberOfPhases !== 1 && siteArea.numberOfPhases !== 3) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'checkIfSiteAreaIsValid',
        message: `Number of phases must be either 1 or 3 in Site Area '${siteArea.name}'`
      });
    }
    // Charging Stations
    if (!siteArea.chargingStations) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.SMART_CHARGING,
        module: MODULE_NAME, method: 'checkIfSiteAreaIsValid',
        message: `No Charging Stations found in Site Area '${siteArea.name}'`
      });
    }
  }

  private async handleRefusedChargingProfile(tenantID: string, chargingProfile: ChargingProfile, siteAreaName: string): Promise<boolean> {
    // Retry setting the cp 2 more times
    for (let i = 0; i < 2; i++) {
      try {
        // Set Charging Profile
        await OCPPUtils.setAndSaveChargingProfile(this.tenantID, chargingProfile);
        return true;
      } catch (error) {
        // Log failed
        Logging.logError({
          tenantID: this.tenantID,
          source: chargingProfile.chargingStationID,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          module: MODULE_NAME, method: 'handleRefusedChargingProfile',
          message: 'Setting Charging Profiles failed 3 times.',
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    // Remove Charging Station from Smart Charging
    const chargingStation = await ChargingStationStorage.getChargingStation(tenantID, chargingProfile.chargingStationID);
    chargingStation.excludeFromSmartCharging = true;
    await ChargingStationStorage.saveChargingStation(tenantID, chargingStation);
    // Notify Admins
    await NotificationHandler.sendComputeAndApplyChargingProfilesFailed(tenantID,
      { chargeBoxID: chargingProfile.chargingStationID,
        siteAreaName: siteAreaName,
        evseDashboardURL: Utils.buildEvseURL()
      });
    return false;
  }

  async abstract buildChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]>;

  async abstract checkConnection(): Promise<void>;
}
