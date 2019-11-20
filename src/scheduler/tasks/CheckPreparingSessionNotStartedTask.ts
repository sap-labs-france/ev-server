import moment from 'moment';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { CheckPreparingSessionNotStartedTaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';

export default class CheckPreparingSessionNotStartedTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: CheckPreparingSessionNotStartedTaskConfig): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'CheckPreparingSessionNotStartedTask',
        method: 'run', action: 'CheckPreparingSessionNotStartedTask',
        message: 'The subtask \'CheckPreparingSessionNotStartedTask\' is being run'
      });
      // Compute the date some minutes ago
      const someMinutesAgo = moment().subtract(config.preparingStatusMaxMins, 'minutes').toDate();
      const params = { 'statusChangedBefore': someMinutesAgo, 'connectorStatus': Constants.CONN_STATUS_PREPARING };
      // Get Charging Stations
      const chargingStations:any = await ChargingStationStorage.getChargingStationsByConnectorStatus(tenant.id, params);
      for (const chargingStation of chargingStations) {
        // Get site owner and then send notification
        if (chargingStation.siteAreaID) {
          const sitearea = await SiteAreaStorage.getSiteArea(tenant.id,chargingStation.siteAreaID, { withSite: true, withChargeBoxes: true });
          if (sitearea && sitearea.siteID) {
            const siteUsers = await SiteStorage.getUsers(tenant.id, { siteID: sitearea.siteID }, Constants.DB_PARAMS_MAX_LIMIT);
            for (const siteUser of siteUsers.result) {
              if (siteUser.siteOwner) {
                // Send notification
                moment.locale(siteUser.user.locale);
                NotificationHandler.sendPreparingSessionNotStartedNotification(tenant.id,siteUser.user.id,siteUser.user, {
                  'user': siteUser.user,
                  'chargeBoxID': chargingStation.id,
                  'startedOn': moment(chargingStation.connectors.statusLastChangedOn).format('LL'),
                  'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckPreparingSessionNotStartedTask', error);
    }
  }
}
