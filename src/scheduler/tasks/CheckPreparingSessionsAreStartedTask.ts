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
import Constants from '../../utils/Constants';
import SiteAreaStorage from '../../storage/mongodb/SiteAreaStorage';
import OCPPStorage from '../../storage/mongodb/OCPPStorage';
import SiteArea from '../../types/SiteArea';
import SiteStorage from '../../storage/mongodb/SiteStorage';

export default class CheckPreparingSessionsAreStartedTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'CheckPreparingSessionsAreStartedTask',
        method: 'run', action: 'CheckPreparingSessionsAreStartedTask',
        message: 'The subtask \'CheckPreparingSessionsAreStartedTask\' is being run'
      });
      // Compute the date some minutes ago
      const someMinutesAgo = moment().subtract(config.preparingStatusMaxMins, 'minutes').toDate().toISOString();
      const params= { 'statusChangedBefore': someMinutesAgo, 'connectorStatus': Constants.CONN_STATUS_PREPARING };
      const chargers:any = await ChargingStationStorage.getChargingStationsByConnectorStatus(tenant.id, params);
      for(const charger of chargers){
        // get site owner and then send notification
        // To be finished when the site owner feature is available
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckPreparingSessionsAreStartedTask', error);
    }
  }
}
