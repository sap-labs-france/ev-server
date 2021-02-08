lastChangedOnimport Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import { ServerAction } from '../../types/Server';
import global from '../../types/GlobalType';

const MODULE_NAME = 'AddLastChangedOnToCarCatalogTask';

export default class AddLastChangedOnToCarCatalogTask extends MigrationTask {
  async migrate(): Promise<void> {
    try {
      const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'carcatalogs').updateMany({
        'lastChangedOn': { $exists: false }
      },
      [
        { '$set': { 'lastChangedOn': '$createdOn' } }
      ]);
      if (result.modifiedCount > 0) {
        Logging.logDebug({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.MIGRATION,
          module: MODULE_NAME, method: 'migrate',
          message: `${result.modifiedCount} Car(s) catalog(s) have been updated in the default tenant`
        });
      }
    } catch (error) {
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'migrate',
        action: ServerAction.MIGRATION,
        message: `Error while updating the Cars catalog: ${error.message}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }

  getVersion(): string {
    return '1.0';
  }

  isAsynchronous(): boolean {
    return true;
  }

  getName(): string {
    return 'AddLastChangedOnToCarCatalogTask';
  }
}
