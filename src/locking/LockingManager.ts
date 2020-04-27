import cfenv from 'cfenv';
import os from 'os';
import BackendError from '../exception/BackendError';
import LockingStorage from '../storage/mongodb/LockingStorage';
import Lock, { LockType } from '../types/Lock';
import { ServerAction } from '../types/Server';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Cypher from '../utils/Cypher';
import Logging from '../utils/Logging';

const MODULE_NAME = 'LockingManager';

/**
 * Namespace based runtime locking primitive management with a DB storage for sharing purpose among different hosts.
 * Implemented lock types:
 *  - E = mutually exclusive
 */
export default class LockingManager {
  public static create(name: string, type = LockType.EXCLUSIVE, tenantID: string = Constants.DEFAULT_TENANT, onMultipleHosts = true): Lock {
    if (!name) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME,
        method: 'init',
        message: 'Lock must have a name'
      });
    }
    // Return the built lock
    return {
      id: Cypher.hash(`${name.toLowerCase()}~${type}~${tenantID}`),
      tenantID,
      name: name.toLowerCase(),
      type: type,
      timestamp: new Date(),
      hostname: Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname()
    };
  }

  public static async acquire(lock: Lock): Promise<boolean> {
    try {
      switch (lock.type) {
        case LockType.EXCLUSIVE:
          await LockingStorage.insertLock(lock);
          break;
        default:
          throw new BackendError({
            action: ServerAction.LOCKING,
            module: MODULE_NAME, method: 'acquire',
            message: `Cannot acquire a lock with an unknown type ${lock.type}`,
            detailedMessages: { lock }
          });
      }
      Logging.logDebug({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Lock '${lock.name}' of type '${lock.type}' has been acquired successfully`,
        detailedMessages: { lock }
      });
      return true;
    } catch (error) {
      Logging.logError({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Cannot acquire the lock '${lock.name}' of type '${lock.type}'`,
        detailedMessages: { lock, error: error.message, stack: error.stack }
      });
      return false;
    }
  }

  public static async release(lock: Lock): Promise<boolean> {
    // Delete
    const result = await LockingStorage.deleteLock(lock);
    if (!result) {
      Logging.logError({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'release',
        action: ServerAction.LOCKING,
        message: `Lock '${lock.name}' of type '${lock.type}' does not exist and cannot be released`,
        detailedMessages: { lock }
      });
      return false;
    }
    Logging.logDebug({
      tenantID: lock.tenantID,
      module: MODULE_NAME, method: 'release',
      action: ServerAction.LOCKING,
      message: `Lock '${lock.name}' of type '${lock.type}' has been released successfully`,
      detailedMessages: { lock }
    });
    return true;
  }
}
