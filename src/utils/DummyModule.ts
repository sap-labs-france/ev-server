import Constants from './Constants';
import Logging from './Logging';
import { ServerAction } from '../types/Server';

const MODULE_NAME = 'DummyModule';

export default class DummyModule {
  constructor() {
    const error = new Error();
    Logging.logDebug({
      tenantID: Constants.DEFAULT_TENANT,
      source: Constants.CENTRAL_SERVER,
      action: ServerAction.IMPORT_MODULE,
      module: MODULE_NAME, method: 'constructor',
      message: MODULE_NAME + ' have been imported, ensure its import follow its proper usage',
      detailedMessages: { stack: error.stack }
    });
  }
}
