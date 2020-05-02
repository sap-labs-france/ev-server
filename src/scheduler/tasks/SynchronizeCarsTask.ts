import CarFactory from '../../integration/car/CarFactory';
import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'SynchronizeCarsTask';

export default class SynchronizeCarsTask extends SchedulerTask {
  async run(name: string, config: TaskConfig): Promise<void> {
    // Get the lock
    const carLock = LockingManager.createExclusiveLock(Constants.DEFAULT_TENANT, LockEntity.CAR, 'synchronize-cars');
    if (await LockingManager.acquire(carLock)) {
      try {
        const carDatabaseImpl = await CarFactory.getCarImpl();
        if (carDatabaseImpl) {
          const synchronizeAction = await carDatabaseImpl.synchronizeCarCatalogs();
          if (synchronizeAction.inError > 0) {
            await NotificationHandler.sendCarsSynchronizationFailed({
              nbrCarsInError: synchronizeAction.inError,
              evseDashboardURL: Utils.buildEvseURL()
            });
          }
        }
        // Release the lock
        await LockingManager.release(carLock);
      } catch (error) {
        // Release the lock
        await LockingManager.release(carLock);
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'run',
          action: ServerAction.SYNCHRONIZE_CAR_CATALOGS,
          message: `Error while running the task '${name}': ${error.message}`,
          detailedMessages: { error: error.message, stack: error.stack }
        });
      }
    }
  }
}
