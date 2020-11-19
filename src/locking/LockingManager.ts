import Lock, { LockEntity, LockType } from '../types/Locking';

import BackendError from '../exception/BackendError';
import Configuration from '../utils/Configuration';
import Cypher from '../utils/Cypher';
import LockingStorage from '../storage/mongodb/LockingStorage';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import Utils from '../utils/Utils';
import cfenv from 'cfenv';
import os from 'os';

const MODULE_NAME = 'LockingManager';

/**
 * Namespace based runtime locking primitive management with a DB storage for sharing purpose among different hosts.
 * Implemented lock types:
 *  - E = mutually exclusive
 */
export default class LockingManager {
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
            message: `Cannot acquire a lock entity '${lock.entity}' ('${lock.key}') with an unknown type '${lock.type}'`,
            detailedMessages: { lock }
          });
      }
      Logging.logDebug({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Acquired successfully the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
        detailedMessages: { lock }
      });
      Utils.isDevelopmentEnv() && console.debug(`Acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`);
      return true;
    } catch (error) {
      Logging.logWarning({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Cannot acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID ${lock.tenantID}`,
        detailedMessages: { lock, error: error.message, stack: error.stack }
      });
      Utils.isDevelopmentEnv() && console.warn(`>>>>> Cannot acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`);
      return false;
    }
  }

  public static async release(lock: Lock): Promise<boolean> {
    // Delete
    const result = await LockingStorage.deleteLock(lock);
    if (!result) {
      Logging.logWarning({
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
      message: `Released successfully the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
      detailedMessages: { lock }
    });
    Utils.isDevelopmentEnv() && console.debug(`Released the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`);
    return true;
  }

  private static createLock(tenantID: string, entity: LockEntity, key: string, type: LockType = LockType.EXCLUSIVE): Lock {
    if (!tenantID) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME, method: 'createLock',
        message: 'Tenant must be provided',
        detailedMessages: { tenantID, entity, key, type }
      });
    }
    if (!entity) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME, method: 'createLock',
        message: 'Entity must be provided',
        detailedMessages: { tenantID, entity, key, type }
      });
    }
    if (!key) {
      throw new BackendError({
        action: ServerAction.LOCKING,
        module: MODULE_NAME, method: 'createLock',
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
}
