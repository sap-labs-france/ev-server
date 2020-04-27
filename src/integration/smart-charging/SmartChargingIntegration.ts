import { ActionsResponse } from '../../types/GlobalType';
import BackendError from '../../exception/BackendError';
import { ChargingProfile } from '../../types/ChargingProfile';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import { ServerAction } from '../../types/Server';
import SiteArea from '../../types/SiteArea';
import { SmartChargingSetting } from '../../types/Setting';

const MODULE_NAME = 'SmartCharging';

export default abstract class SmartChargingIntegration<T extends SmartChargingSetting> {
  protected readonly tenantID: string;
  protected readonly setting: T;

  protected constructor(tenantID: string, setting: T) {
    this.tenantID = tenantID;
    this.setting = setting;
  }

  public async computeAndApplyChargingProfiles(siteArea: SiteArea): Promise<ActionsResponse> {
    const actionsResponse: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
    Logging.logDebug({
      tenantID: this.tenantID,
      action: ServerAction.CHARGING_PROFILE_UPDATE,
      message: 'Compute and Apply Charging Profiles is being called',
      module: MODULE_NAME, method: 'computeAndApplyChargingProfiles',
      detailedMessages: { siteArea }
    });
    // Call the charging plans
    const chargingProfiles: ChargingProfile[] = await this.buildChargingProfiles(siteArea);
    if (!chargingProfiles) {
      throw new BackendError({
        action: ServerAction.CHARGING_PROFILE_UPDATE,
        module: MODULE_NAME, method: 'computeAndApplyChargingProfiles',
        message: `No Charging Profiles have been built for Site Area '${siteArea.name}'`,
      });
    }
    // Apply the charging plans
    for (const chargingProfile of chargingProfiles) {
      try {
        // Set Charging Profile
        await OCPPUtils.setAndSaveChargingProfile(this.tenantID, chargingProfile);
        actionsResponse.inSuccess++;
      } catch (error) {
        // Log failed
        actionsResponse.inError++;
        Logging.logError({
          tenantID: this.tenantID,
          source: chargingProfile.chargingStationID,
          action: ServerAction.CHARGING_PROFILE_UPDATE,
          module: MODULE_NAME, method: 'computeAndApplyChargingProfiles',
          message: `Setting Charging Profiles for Site Area '${siteArea.name}' failed`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
    if (actionsResponse.inSuccess && actionsResponse.inError) {
      Logging.logError({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
        module: MODULE_NAME, method: 'processTenant',
        message: `${actionsResponse.inSuccess} charging plan(s) were successfully pushed and ${actionsResponse.inError} have failed`
      });
    } else if (actionsResponse.inSuccess) {
      Logging.logInfo({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
        module: MODULE_NAME, method: 'processTenant',
        message: `${actionsResponse.inSuccess} charging plan(s) were successfully pushed`
      });
    } else if (actionsResponse.inError) {
      Logging.logError({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
        module: MODULE_NAME, method: 'processTenant',
        message: `${actionsResponse.inError} charging plan(s) have failed to be pushed`
      });
    } else {
      Logging.logWarning({
        tenantID: this.tenantID,
        source: Constants.CENTRAL_SERVER,
        action: ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
        module: MODULE_NAME, method: 'processTenant',
        message: 'No charging stations have been updated with charging plans'
      });
    }
    Logging.logDebug({
      tenantID: this.tenantID,
      action: ServerAction.CHARGING_PROFILE_UPDATE,
      message: 'Compute and Apply Charging Profiles has been called',
      module: MODULE_NAME, method: 'computeAndApplyChargingProfiles'
    });
    return actionsResponse;
  }

  async abstract buildChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]>;

  async abstract checkConnection();
}
