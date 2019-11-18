import moment from 'moment';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../../types/TaskConfig';

export default class CheckPreparingSessionNotStartedTask extends SchedulerTask {

  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.id,
        module: 'CheckPreparingSessionNotStartedTask',
        method: 'run', action: 'CheckPreparingSessionNotStartedTask',
        message: 'The subtask \'CheckPreparingSessionNotStartedTask\' is being run'
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
      Logging.logActionExceptionMessage(tenant.id, 'CheckPreparingSessionNotStartedTask', error);
    }
  }
}
