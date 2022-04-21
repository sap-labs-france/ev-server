import AbstractAsyncTask from '../AsyncTask';
import BackendError from '../../exception/BackendError';
import CarFactory from '../../integration/car/CarFactory';
import Constants from '../../utils/Constants';
import LockingHelper from '../../locking/LockingHelper';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import { ServerAction } from '../../types/Server';

const MODULE_NAME = 'SynchronizeCarCatalogsAsyncTask';

export default class SynchronizeCarCatalogsAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const syncCarCatalogsLock = await LockingHelper.acquireSyncCarCatalogsLock(Constants.DEFAULT_TENANT_ID);
    if (syncCarCatalogsLock) {
      try {
        const carDatabaseImpl = CarFactory.getCarImpl();
        if (!carDatabaseImpl) {
          throw new BackendError({
            message: 'Car service is not configured',
            module: MODULE_NAME, method: 'executeAsyncTask'
          });
        }
        await carDatabaseImpl.synchronizeCarCatalogs();
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(Constants.DEFAULT_TENANT_ID, ServerAction.SYNCHRONIZE_CAR_CATALOGS, error);
      } finally {
        // Release the lock
        await LockingManager.release(syncCarCatalogsLock);
      }
    }
  }
}
