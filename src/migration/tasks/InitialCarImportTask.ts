import CarDatabaseFactory from '../../integration/car/CarDatabaseFactory';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';

export default class InitialCarImportTask extends MigrationTask {
  async migrate() {
    try {
      const carDatabaseImpl = await CarDatabaseFactory.getCarDatabaseImpl();
      if (carDatabaseImpl) {
        const synchronizeAction = await carDatabaseImpl.synchronizeCars();
        if (synchronizeAction.error > 0) {
          Logging.logError({
            tenantID: Constants.DEFAULT_TENANT,
            module: 'InitialCarImportTask', method: 'migrate',
            action: 'InitialCarImport',
            message: `${synchronizeAction.synchronized} Cars were imported successfully, ${synchronizeAction.error} in error`,
          });
        } else if (synchronizeAction.synchronized > 0) {
          Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            module: 'InitialCarImportTask', method: 'migrate',
            action: 'InitialCarImport',
            message: `${synchronizeAction.synchronized} Cars were imported successfully`,
          });
        }
      }
    } catch (error) {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'InitialCarImportTask', method: 'migrate',
        action: 'InitialCarImport',
        message: `Error while importing the Cars: ${error.message}`,
        detailedMessages: error
      });
    }
  }

  getVersion() {
    return '1.0';
  }

  getName() {
    return 'InitialCarImportTask';
  }
}
