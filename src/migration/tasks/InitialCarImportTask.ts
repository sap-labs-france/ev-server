import CarDatabaseFactory from '../../integration/car/CarDatabaseFactory';
import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';

export default class InitialCarImportTask extends MigrationTask {
  async migrate() {
    try {
      const carDatabaseImpl = await CarDatabaseFactory.getCarDatabaseImpl();
      if (carDatabaseImpl) {
        await carDatabaseImpl.synchronizeCars();
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

  isAsynchronous() {
    return true;
  }

  getName() {
    return 'InitialCarImportTask';
  }
}
