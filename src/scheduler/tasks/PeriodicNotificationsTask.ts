import moment from 'moment';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../TaskConfig';
import Tenant from '../../types/Tenant';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';
import UserStorage from '../../storage/mongodb/UserStorage';
import _ from 'lodash';
import { Subtasks } from '../../types/configuration/SchedulerConfiguration';
import Constants from '../../utils/Constants';
import ChargingStation from '../../types/ChargingStation';

export default class PeriodicNotificationsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig, subtasks: Subtasks[]): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'PeriodicNotificationsTask',
        method: 'run', action: 'PeriodicNotificationsTask',
        message: 'The task \'PeriodicNotificationsTask\' is being run'
      });
      for(const subtask of subtasks) {
        // Check active
        if(subtask.active){
          switch (subtask.name) {
            case 'CheckChargingStationsHeartbeatsTask':
              this.checkChargingStationsHeartbeats(tenant);
              break;
            case 'DetectForgetChargeTask':
              this.detectForgetCharge(tenant);
              break;
            default:
              Logging.logError({
                tenantID: tenant.id,
                module: 'PeriodicNotificationsTask', method: 'run',
                action: 'Subtask',
                message: `The subtask '${subtask.name}' is unknown`
              });
          }
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'PeriodicNotificationsTask', error);
    }
  }

  async detectForgetCharge(tenant: Tenant): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'DetectForgetChargeTask',
        method: 'run', action: 'DetectForgetChargeTask',
        message: 'The subtask \'DetectForgetChargeTask\' is being run'
      });
      // Compute the date some minutes ago
      const someMinutesAgo = moment().subtract(Constants.TASK_PREPARING_THRESHOLD, 'minutes').toDate().toISOString();
      const params= { 'since': someMinutesAgo };
      const chargers:any = await ChargingStationStorage.getChargingStationsPreparingSince(tenant.id, params);
      for(const charger of chargers){
        // get user
        if(charger.transaction.tagID) {
          const user = await UserStorage.getUserByTagId(tenant.id, charger.transaction.tagID);
          // send notification
          const notificationID = user.id + Date.now();
          NotificationHandler.sendForgetChargeNotification(
            tenant.id,
            notificationID,
            user,
            {
              'user': user,
              'chargingStation': charger.id,
              'startedOn': charger.connectors.activeTransactionDate,
              'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
            }
          );
        }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'DetectForgetChargeTask', error);
    }
  }

  async checkChargingStationsHeartbeats(tenant: Tenant): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'CheckChargingStationsHeartbeatsTask',
        method: 'run', action: 'checkChargingStationsHeartbeats',
        message: 'The subtask \'CheckChargingStationsHeartbeatsTask\' is being run'
      });
      // Compute the date some minutes ago
      const someMinutesAgo = moment().subtract(Constants.TASK_HEARTBEAT_THRESHOLD, 'minutes').toDate().toISOString();
      const params= { 'since': someMinutesAgo };
      const chargers:ChargingStation[] = await ChargingStationStorage.getChargingStationsNoHeartbeatSince(tenant.id, params);
      for(const charger of chargers){
        // send notification
        NotificationHandler.sendNoHeartbeat(
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
      Logging.logActionExceptionMessage(tenant.id, 'CheckChargingStationsHeartbeatsTask', error);
    }
  }
}

