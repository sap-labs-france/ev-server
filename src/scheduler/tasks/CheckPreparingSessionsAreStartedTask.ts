import moment from 'moment';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../TaskConfig';
import Tenant from '../../types/Tenant';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import _ from 'lodash';
import Constants from '../../utils/Constants';

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
      const params = { 'statusChangedBefore': someMinutesAgo, 'connectorStatus': Constants.CONN_STATUS_PREPARING };
      const chargers:any = await ChargingStationStorage.getChargingStationsByConnectorStatus(tenant.id, params);
      for (const charger of chargers) {
        // Get site owner and then send notification
        // To be finished when the site owner feature is available
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckPreparingSessionsAreStartedTask', error);
    }
  }
}
