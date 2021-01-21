import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { CheckOfflineChargingStationsTaskConfig } from '../../types/TaskConfig';
import Configuration from '../../utils/Configuration';
import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { OCPPGetConfigurationCommandResult } from '../../types/ocpp/OCPPClient';
import OCPPUtils from '../../server/ocpp/utils/OCPPUtils';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

const MODULE_NAME = 'CheckOfflineChargingStationsTask';

export default class CheckOfflineChargingStationsTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: CheckOfflineChargingStationsTaskConfig): Promise<void> {
    // Get the lock
    const offlineChargingStationLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.CHARGING_STATION, 'offline-charging-station');
    if (await LockingManager.acquire(offlineChargingStationLock)) {
      try {
        // Compute the date some minutes ago
        const offlineSince = moment().subtract(
          Configuration.getChargingStationConfig().maxLastSeenIntervalSecs, 'seconds').toDate();
        const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
          issuer: true,
          offlineSince
        }, Constants.DB_PARAMS_MAX_LIMIT);
        if (chargingStations.count > 0) {
          for (let i = chargingStations.result.length - 1; i >= 0; i--) {
            const chargingStation = chargingStations.result[i];
            let ocppHeartbeatConfiguration: OCPPGetConfigurationCommandResult;
            // Check if charging station is still connected
            try {
              const ocppParamHeartbeatKeys = ['HeartBeatInterval', 'HeartbeatInterval'];
              ocppHeartbeatConfiguration = await OCPPUtils.requestChargingStationOcppParameters(tenant.id, chargingStation, { key: ocppParamHeartbeatKeys });
            } catch (error) {
              // Charging Station is offline!
              continue;
            }
            // Charging Station is still connected: ignore it
            if (ocppHeartbeatConfiguration) {
              Logging.logInfo({
                tenantID: tenant.id,
                source: chargingStation.id,
                action: ServerAction.OFFLINE_CHARGING_STATION,
                module: MODULE_NAME, method: 'processTenant',
                message: 'Offline charging station responded successfully to an OCPP command and will be ignored',
              });
              // Update lastSeen
              await ChargingStationStorage.saveChargingStationLastSeen(tenant.id, chargingStation.id,
                { lastSeen: new Date() }
              );
              // Remove charging station from notification
              chargingStations.result.splice(i, 1);
            // Check if inactive
            } else if (chargingStation.forceInactive) {
              // Remove charging station from notification
              chargingStations.result.splice(i, 1);
            }
          }
          // Notify users with the rest of the Charging Stations
          if (chargingStations.result.length > 0) {
            const chargingStationIDs: string = chargingStations.result.map((chargingStation) => chargingStation.id).join(', ');
            // Send notification
            await NotificationHandler.sendOfflineChargingStations(
              tenant.id, {
                chargeBoxIDs: chargingStationIDs,
                evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
              }
            );
          }
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

