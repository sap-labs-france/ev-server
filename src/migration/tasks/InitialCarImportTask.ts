import CarFactory from '../../integration/car/CarFactory';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';

const MODULE_NAME = 'InitialCarImportTask';

export default class InitialCarImportTask extends MigrationTask {
  async migrate(): Promise<void> {
    try {
      const carDatabaseImpl = await CarFactory.getCarImpl();
      if (carDatabaseImpl) {
        await carDatabaseImpl.synchronizeCarCatalogs();
      }
    } catch (error) {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrate',
        action: ServerAction.CAR_CATALOG_SYNCHRONIZATION,
        message: `Error while importing the Cars: ${error.message}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  getVersion(): string {
    return '1.5';
  }

  isAsynchronous(): boolean {
    return true;
  }

  getName(): string {
    return 'InitialCarImportTask';
  }
}
