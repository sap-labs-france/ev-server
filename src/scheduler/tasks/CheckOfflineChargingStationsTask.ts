import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { CheckOfflineChargingStationsTaskConfig } from '../../types/TaskConfig';
import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

export default class CheckOfflineChargingStationsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: CheckOfflineChargingStationsTaskConfig): Promise<void> {
    // Get the lock
    const offlineChargingStationLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.CHARGING_STATION, 'offline-charging-station');
    if (await LockingManager.acquire(offlineChargingStationLock)) {
      try {
        // Compute the date some minutes ago
        const someMinutesAgo = moment().subtract(
          Utils.getChargingStationHeartbeatMaxIntervalSecs(), 'seconds').toDate();
        const params = {
          issuer: true,
          offlineSince: someMinutesAgo
        };
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
        Logging.logActionExceptionMessage(tenant.id, ServerAction.OFFLINE_CHARGING_STATION, error);
      } finally {
        // Release the lock
        await LockingManager.release(offlineChargingStationLock);
      }
    }
  }
}

