import { ActionsResponse } from '../../types/GlobalType';
import BackendError from '../../exception/BackendError';
import { ChargingProfile } from '../../types/ChargingProfile';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
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

  public async computeAndApplyChargingProfiles(siteArea: SiteArea): Promise<ActionsResponse> {
    const actionsResponse: ActionsResponse = {
      inSuccess: 0,
      inError: 0
    };
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
    // Log
    Utils.logActionsResponse(this.tenantID, ServerAction.CHECK_AND_APPLY_SMART_CHARGING,
      MODULE_NAME, 'computeAndApplyChargingProfiles', actionsResponse,
      '{{inSuccess}} charging plan(s) were successfully pushed',
      '{{inError}} charging plan(s) failed to be pushed',
      '{{inSuccess}} charging plan(s) were successfully pushed and {{inError}} failed to be pushed',
      'No charging plans have been pushed'
    );
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

  async abstract buildChargingProfiles(siteArea: SiteArea): Promise<ChargingProfile[]>;

  async abstract checkConnection();
}
