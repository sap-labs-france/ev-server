import cfenv from 'cfenv';
import os from 'os';
import LockingStorage from '../storage/mongodb/LockingStorage';
import { Action } from '../types/Authorization';
import Lock from '../types/Lock';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Cypher from '../utils/Cypher';
import Logging from '../utils/Logging';

const MODULE_NAME = 'LockManager';

/**
 * Namespace based runtime locking primitive management with a DB storage for sharing purpose among different hosts.
 * Implemented lock type:
 *  - E = mutually exclusive
 */
export default class LockManager {
  public static init(name: string, type = 'E', onMultipleHosts = true): Lock {
    if (!name) {
      const logMsg = 'Lock must have a unique name';
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'init',
        action: Action.LOCKING,
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      return;
    }
    return {
      keyHash: Cypher.hash(name.toLowerCase() + '~' + type),
      name: name.toLowerCase(),
      type: type,
      timestamp: new Date(),
      hostname: Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname(),
      onMultipleHosts: onMultipleHosts,
    };
  }

  public static async acquire(lock: Lock): Promise<void> {
    if (!await LockingStorage.getLockStatus(lock)) {
      await LockingStorage.saveLock(lock);
    }
  }

  public static async tryAcquire(lock: Lock): Promise<boolean> {
    if (await LockingStorage.getLockStatus(lock)) {
      return false;
    }
    await LockingStorage.saveLock(lock);
    return true;
  }

  public static async release(lock: Lock): Promise<void> {
    if (!await LockingStorage.getLockStatus(lock)) {
      const logMsg = `Lock ${this.name} is not acquired`;
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'release',
        action: Action.LOCKING,
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      return;
    }
    await LockingStorage.deleteLock(lock);
  }
}
