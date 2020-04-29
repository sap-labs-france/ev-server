import cfenv from 'cfenv';
import os from 'os';
import BackendError from '../exception/BackendError';
import LockingStorage from '../storage/mongodb/LockingStorage';
import Lock, { LockEntity, LockType } from '../types/Locking';
import { ServerAction } from '../types/Server';
import Configuration from '../utils/Configuration';
import Cypher from '../utils/Cypher';
import Logging from '../utils/Logging';

const MODULE_NAME = 'LockingManager';

/**
 * Namespace based runtime locking primitive management with a DB storage for sharing purpose among different hosts.
 * Implemented lock types:
 *  - E = mutually exclusive
 */
export default class LockingManager {
  private static createLock(tenantID: string, entity: LockEntity, key: string, type: LockType = LockType.EXCLUSIVE): Lock {
    if (!tenantID) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME, method: 'init',
        message: 'Tenant must be provided',
        detailedMessages: { tenantID, entity, key, type }
      });
    }
    if (!entity) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME, method: 'init',
        message: 'Entity must be provided',
        detailedMessages: { tenantID, entity, key, type }
      });
    }
    if (!key) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME, method: 'init',
        message: 'Key must be provided',
        detailedMessages: { tenantID, entity, key, type }
      });
    }
    // Return the built lock
    return {
      id: Cypher.hash(`${tenantID}~${entity}~${key.toLowerCase()}~${type}`),
      tenantID,
      entity: entity,
      key: key.toLowerCase(),
      type: type,
      timestamp: new Date(),
      hostname: Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname()
    };
  }

  public static createExclusiveLock(tenantID: string, entity: LockEntity, key: string): Lock {
    return this.createLock(tenantID, entity, key, LockType.EXCLUSIVE);
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
            message: `Cannot acquire a Lock entity '${lock.entity}' ('${lock.key}') with an unknown type '${lock.type}'`,
            detailedMessages: { lock }
          });
      }
      Logging.logDebug({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Acquired successfully the Lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
        detailedMessages: { lock }
      });
      return true;
    } catch (error) {
      Logging.logError({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Cannot acquire the Lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
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
        message: `Lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' does not exist and cannot be released`,
        detailedMessages: { lock }
      });
      return false;
    }
    Logging.logDebug({
      tenantID: lock.tenantID,
      module: MODULE_NAME, method: 'release',
      action: ServerAction.LOCKING,
      message: `Released successfully the Lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
      detailedMessages: { lock }
    });
    return true;
  }
}
