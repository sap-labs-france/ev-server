import CarFactory from '../../integration/car/CarFactory';
import Constants from '../../utils/Constants';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import { TaskConfig } from '../../types/TaskConfig';
import Utils from '../../utils/Utils';

export default class SynchronizeCarsTask extends SchedulerTask {
  public async processTask(config: TaskConfig): Promise<void> {
    // Get the lock
    const syncCarCatalogLock = await LockingHelper.acquireSyncCarCatalogsLock(Constants.DEFAULT_TENANT_ID);
    if (syncCarCatalogLock) {
      try {
        const carDatabaseImpl = CarFactory.getCarImpl();
        if (carDatabaseImpl) {
          const synchronizeAction = await carDatabaseImpl.synchronizeCarCatalogs();
          if (synchronizeAction.inError > 0) {
            void NotificationHandler.sendCarsSynchronizationFailed({
              nbrCarsInError: synchronizeAction.inError,
              evseDashboardURL: Utils.buildEvseURL()
            });
          }
        }
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT_ID, ServerAction.SYNCHRONIZE_CAR_CATALOGS, error);
      } finally {
        // Release the lock
        await LockingManager.release(syncCarCatalogLock);
      }
    }
  }
}
