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

const PREPARING_LIMIT = 15; // Threshold of nbr of minutes with status in preparing
const INACTIVITY_LIMIT = 5; // Threshold of nbr of months with no login

export default class PeriodicNotificationsTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig, subtasks: Subtasks[]): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'NotificationsTask',
        method: 'run', action: 'NotificationsTask',
        message: 'The task \'NotificationsTask\' is being run'
      });
      for(const subtask of subtasks) {
        // Check active
        if(subtask.active){
          switch (subtask.name) {
            case 'CheckUsersInactivityTask':
              this.checkUsersInactivity(tenant);
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
      const someMinutesAgo = moment().subtract(PREPARING_LIMIT, 'minutes').toDate().toISOString();
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

  async checkUsersInactivity(tenant: Tenant): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'CheckUsersInactivityTask',
        method: 'run', action: 'InactiveUsersNotification',
        message: 'The subtask \'CheckUsersInactivityTask\' is being run'
      });
      // Compute the date some months ago
      const someMonthsAgo = moment().subtract(INACTIVITY_LIMIT, 'months').toDate().toISOString();
      const params= { 'statuses': ['A'], 'noLoginSince': someMonthsAgo };
      const users = await UserStorage.getUsersInactiveSince(tenant.id, params);
      for(const user of users){
        // Notification 
        moment.locale(user.locale);
        const notificationId = user.id + new Date().toString();
        NotificationHandler.sendUserInactivityLimitReached(
          tenant.id,
          notificationId,
          user,
          {
            'user': user,
            'lastLogin': moment(user.lastLogin).format('LL'),
            'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
          }
        );
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckUsersInactivityTask', error);
    }
  }
}

