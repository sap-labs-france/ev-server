import moment from 'moment';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../TaskConfig';
import Tenant from '../../types/Tenant';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import NotificationHandler from '../../notification/NotificationHandler';
import Utils from '../../utils/Utils';
import UserStorage from '../../storage/mongodb/UserStorage';

const PREPARING_LIMIT = 15; // Threshold of nbr of minutes with status in preparing

export default class DetectForgetChargeTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'DetectForgetChargeTask',
        method: 'run', action: 'DetectForgetChargeTask',
        message: 'The task \'DetectForgetChargeTask\' is being run'
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
          const notificationID = 'ForgetCharge' + user.id + new Date().toString();
          NotificationHandler.sendForgetChargeNotification(
            tenant.id,
            notificationID,
            user,
            {
              'user': user,
              'chargingStation': charger.id,
              'startedOn': charger.connectors.activeTransactionDate,
              'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain)
            },
            user.locale
          );
          }
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'DetectForgetChargeTask', error);
    }
  }
}

