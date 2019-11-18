import moment from 'moment';
import NotificationHandler from '../../notification/NotificationHandler';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import SchedulerTask from '../SchedulerTask';

export default class CheckOfflineChargingStationTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'CheckOfflineChargingStationTask',
        method: 'run', action: 'checkOfflineChargingStation',
        message: 'The subtask \'CheckOfflineChargingStationTask\' is being run'
      });
      // Compute the date some minutes ago
      const someMinutesAgo = moment().subtract(config.offlineChargingStationMins, 'minutes').toDate().toISOString();
      const params= { 'offlineSince': someMinutesAgo };
      const chargers = await ChargingStationStorage.getChargingStations(tenant.id, params, Constants.DB_PARAMS_MAX_LIMIT);
      for(const charger of chargers.result){
        // send notification
        NotificationHandler.sendOfflineChargingStation(
          tenant.id,
          charger,
          {
            'chargingStation': charger.id,
            'lastHeartbeat': charger.lastHeartBeat,
            'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
          }
        );       
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckOfflineChargingStationTask', error);
    }
  }
}

