import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';

export class ServerUtils {
  /**
   * @param methodName
   * @param logMsg
   * @param serverModuleName
   */
  static async defaultListenCb(serverModuleName: string, methodName: string, logMsg: string): Promise<void> {
    // Log
    await Logging.logInfo({
      tenantID: Constants.DEFAULT_TENANT,
      module: serverModuleName, method: methodName,
      action: ServerAction.STARTUP,
      message: logMsg
    });
    // eslint-disable-next-line no-console
    console.log(logMsg);
  }
}
