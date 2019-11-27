import moment from 'moment';
import NotificationHandler from '../../notification/NotificationHandler';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { CheckOfflineChargingStationsTaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import SchedulerTask from '../SchedulerTask';

export default class CheckOfflineChargingStationsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: CheckOfflineChargingStationsTaskConfig): Promise<void> {
    try {
      // Compute the date some minutes ago
      const someMinutesAgo = moment().subtract(config.offlineChargingStationMins, 'minutes').toDate();
      const params = { 'offlineSince': someMinutesAgo };
      const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, params, Constants.DB_PARAMS_MAX_LIMIT);
      if (chargingStations.count > 0) {
        const chargingStationIDs: string = chargingStations.result.map((chargingStation) => chargingStation.id).join(', ');
        // Send notification
        await NotificationHandler.sendOfflineChargingStations(
          tenant.id,
          {
            chargeBoxIDs: chargingStationIDs,
            evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
          }
        );
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckOfflineChargingStationsTask', error);
    }
  }
}

