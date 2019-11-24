import moment from 'moment';
import NotificationHandler from '../../notification/NotificationHandler';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { CheckOfflineChargingStationTaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import SchedulerTask from '../SchedulerTask';

export default class CheckOfflineChargingStationTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: CheckOfflineChargingStationTaskConfig): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'CheckOfflineChargingStationTask',
        method: 'run', action: 'checkOfflineChargingStation',
        message: 'The task \'CheckOfflineChargingStationTask\' is being run'
      });
      // Compute the date some minutes ago
      const someMinutesAgo = moment().subtract(config.offlineChargingStationMins, 'minutes').toDate();
      const params = { 'offlineSince': someMinutesAgo };
      const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, params, Constants.DB_PARAMS_MAX_LIMIT);
      for (const chargingStation of chargingStations.result) {
        // Send notification
        await NotificationHandler.sendOfflineChargingStation(
          tenant.id,
          chargingStation,
          {
            chargeBoxID: chargingStation.id,
            lastHeartbeat: chargingStation.lastHeartBeat,
            evseDashboardChargingStationURL: await Utils.buildEvseChargingStationURL(tenant.id, chargingStation, '#all'),
            evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
          }
        );       
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckOfflineChargingStationTask', error);
    }
  }
}

