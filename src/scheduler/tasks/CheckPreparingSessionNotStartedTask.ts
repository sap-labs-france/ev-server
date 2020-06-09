import { ChargePointStatus } from '../../types/ocpp/OCPPServer';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { CheckPreparingSessionNotStartedTaskConfig } from '../../types/TaskConfig';
import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';
import moment from 'moment';

export default class CheckPreparingSessionNotStartedTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: CheckPreparingSessionNotStartedTaskConfig): Promise<void> {
    // Get the lock
    const sessionNotStartedLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.CHARGING_STATION, 'preparing-session-not-started');
    if (await LockingManager.acquire(sessionNotStartedLock)) {
      try {
        // Get Charging Stations
        const chargingStations = await ChargingStationStorage.getChargingStations(tenant.id, {
          'statusChangedBefore': moment().subtract(config.preparingStatusMaxMins, 'minutes').toDate(),
          'connectorStatuses': [ChargePointStatus.PREPARING]
        }, Constants.DB_PARAMS_MAX_LIMIT);
        for (const chargingStation of chargingStations.result) {
          // Get site owner and then send notification
          if (chargingStation.siteArea && chargingStation.siteArea.siteID) {
            // Get Site Owners
            const siteOwners = await SiteStorage.getSiteUsers(tenant.id, { siteID: chargingStation.siteArea.siteID, siteOwnerOnly: true }, Constants.DB_PARAMS_MAX_LIMIT);
            if (siteOwners && siteOwners.count > 0) {
              // Send notification
              moment.locale(siteOwners.result[0].user.locale);
              for (const connector of chargingStation.connectors) {
                await NotificationHandler.sendPreparingSessionNotStarted(tenant.id, chargingStation, siteOwners.result[0].user, {
                  user: siteOwners.result[0].user,
                  chargeBoxID: chargingStation.id,
                  connectorId: Utils.getConnectorLetterFromConnectorID(connector.connectorId),
                  startedOn: moment(chargingStation.connectors['statusLastChangedOn']).format('LL'),
                  evseDashboardChargingStationURL: await Utils.buildEvseChargingStationURL(tenant.id, chargingStation, '#all'),
                  evseDashboardURL: Utils.buildEvseURL(tenant.subdomain)
                });
              }
            }
          }
        }
      } catch (error) {
        // Log error
        Logging.logActionExceptionMessage(tenant.id, ServerAction.PREPARING_SESSION_NOT_STARTED, error);
      } finally {
        // Release the lock
        await LockingManager.release(sessionNotStartedLock);
      }
    }
  }
}
