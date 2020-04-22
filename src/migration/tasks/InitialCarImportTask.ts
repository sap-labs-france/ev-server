import CarDatabaseFactory from '../../integration/car/CarDatabaseFactory';
import { Action } from '../../types/Authorization';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';

const MODULE_NAME = 'InitialCarImportTask';

export default class InitialCarImportTask extends MigrationTask {
  async migrate() {
    try {
      const carDatabaseImpl = await CarDatabaseFactory.getCarDatabaseImpl();
      if (carDatabaseImpl) {
        await carDatabaseImpl.synchronizeCarCatalogs();
      }
    } catch (error) {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrate',
        action: Action.CAR_CATALOG_SYNCHRONIZATION,
        message: `Error while importing the Cars: ${error.message}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  getVersion() {
    return '1.5';
  }

  isAsynchronous() {
    return true;
  }

  getName() {
    return 'InitialCarImportTask';
  }
}
