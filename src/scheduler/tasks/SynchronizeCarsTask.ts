import CarDatabaseFactory from '../../integration/car/CarDatabaseFactory';
import NotificationHandler from '../../notification/NotificationHandler';
import { Action } from '../../types/Authorization';
import { TaskConfig } from '../../types/TaskConfig';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import SchedulerTask from '../SchedulerTask';

export default class SynchronizeCarsTask extends SchedulerTask {
  async run(name: string, config: TaskConfig): Promise<void> {
    try {
      const carDatabaseImpl = await CarDatabaseFactory.getCarDatabaseImpl();
      if (carDatabaseImpl) {
        const synchronizeAction = await carDatabaseImpl.synchronizeCars();
        if (synchronizeAction.error > 0) {
          await NotificationHandler.sendCarsSynchronizationFailed({
            nbrCarsInError: synchronizeAction.error,
            evseDashboardURL: Utils.buildEvseURL()
          });
        }
      }
    } catch (error) {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'SynchronizeCarsTask', method: 'run',
        action: Action.SYNCHRONIZE_CARS,
        message: `Error while running the task '${name}': ${error.message}`,
        detailedMessages: { error }
      });
    }
  }
}
