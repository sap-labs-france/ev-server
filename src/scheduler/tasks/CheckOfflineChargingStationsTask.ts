import ChargingStationClientFactory from '../../client/ocpp/ChargingStationClientFactory';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { CheckOfflineChargingStationsTaskConfig } from '../../types/TaskConfig';
import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { OCPPGetConfigurationCommandResult } from '../../types/ocpp/OCPPClient';
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
          Utils.getChargingStationHeartbeatMaxIntervalSecs(), 'seconds').toDate();
        const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
          issuer: true,
          offlineSince
        }, Constants.DB_PARAMS_MAX_LIMIT);
        if (chargingStations.count > 0) {
          for (let i = chargingStations.result.length - 1; i >= 0; i--) {
            const chargingStation = chargingStations.result[i];
            let configuration: OCPPGetConfigurationCommandResult;
            // Check if charging station is still connected
            try {
              const chargingStationClient = await ChargingStationClientFactory.getChargingStationClient(tenant.id, chargingStation);
              if (chargingStationClient) {
                configuration = await chargingStationClient.getConfiguration({});
              }
            } catch (error) {
              // Charging Station is offline!
              continue;
            }
            // Charging Station is still connected: ignore it
            if (configuration) {
              Logging.logInfo({
                tenantID: tenant.id,
                source: chargingStation.id,
                action: ServerAction.MIGRATION,
                module: MODULE_NAME, method: 'processTenant',
                message: 'Offline charging station responded successfully to an OCPP command and will be ignored',
              });
              // Update Heartbeat
              await ChargingStationStorage.saveChargingStationHeartBeat(tenant.id, chargingStation.id,
                { lastHeartBeat: new Date() }
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

