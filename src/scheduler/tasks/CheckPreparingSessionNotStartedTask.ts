import moment from 'moment';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import { CheckPreparingSessionNotStartedTaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import SchedulerTask from '../SchedulerTask';

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
      const params= { 'statusChangedBefore': someMinutesAgo, 'connectorStatus': Constants.CONN_STATUS_PREPARING };
      // Get Charging Stations
      const chargingStations = await ChargingStationStorage.getChargingStationsByConnectorStatus(tenant.id, params);
      for (const chargingStation of chargingStations) {
        // get site owner and then send notification
        // To be finished when the site owner feature is available
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.id, 'CheckPreparingSessionNotStartedTask', error);
    }
  }
}
