import Lock, { LockEntity, LockType } from '../types/Locking';

import BackendError from '../exception/BackendError';
import Cypher from '../utils/Cypher';
import LockingStorage from '../storage/mongodb/LockingStorage';
import Logging from '../utils/Logging';
import { ServerAction } from '../types/Server';
import Utils from '../utils/Utils';
import chalk from 'chalk';

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
      await Logging.logDebug({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Acquired successfully the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
        detailedMessages: { lock }
      });
      Utils.isDevelopmentEnv() && console.debug(chalk.green(`Acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`));
      return true;
    } catch (error) {
      await Logging.logWarning({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'acquire',
        action: ServerAction.LOCKING,
        message: `Cannot acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID ${lock.tenantID}`,
        detailedMessages: { lock, error: error.message, stack: error.stack }
      });
      Utils.isDevelopmentEnv() && console.error(chalk.red(`Cannot acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`));
      return false;
    }
  }

  public static async tryAcquire(lock: Lock, timeout: number): Promise<boolean> {
    let timeoutReached = false;
    setTimeout(() => {
      timeoutReached = true;
    }, timeout);
    try {
      switch (lock.type) {
        case LockType.EXCLUSIVE:
          // Busy loop tries
          while (!timeoutReached) {
            try {
              await LockingStorage.insertLock(lock);
              break;
            } catch {
              await Utils.sleep(1000);
            }
          }
          if (timeoutReached) {
            throw Error(`Lock acquisition timeout ${timeout}ms reached`);
          }
          break;
        default:
          throw new BackendError({
            action: ServerAction.LOCKING,
            module: MODULE_NAME, method: 'tryAcquire',
            message: `Cannot acquire a lock entity '${lock.entity}' ('${lock.key}') with an unknown type '${lock.type}'`,
            detailedMessages: { lock }
          });
      }
      await Logging.logDebug({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'tryAcquire',
        action: ServerAction.LOCKING,
        message: `Acquired successfully the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
        detailedMessages: { lock }
      });
      Utils.isDevelopmentEnv() && console.debug(chalk.green(`Acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`));
      return true;
    } catch (error) {
      await Logging.logWarning({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'tryAcquire',
        action: ServerAction.LOCKING,
        message: `Cannot acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID ${lock.tenantID}`,
        detailedMessages: { lock, error: error.message, stack: error.stack }
      });
      Utils.isDevelopmentEnv() && console.error(chalk.red(`Cannot acquire the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`));
      return false;
    }
  }

  public static async release(lock: Lock): Promise<boolean> {
    // Delete
    const result = await LockingStorage.deleteLock(lock);
    if (!result) {
      await Logging.logWarning({
        tenantID: lock.tenantID,
        module: MODULE_NAME, method: 'release',
        action: ServerAction.LOCKING,
        message: `Lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' does not exist and cannot be released`,
        detailedMessages: { lock, stack: new Error().stack }
      });
      return false;
    }
    await Logging.logDebug({
      tenantID: lock.tenantID,
      module: MODULE_NAME, method: 'release',
      action: ServerAction.LOCKING,
      message: `Released successfully the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}'`,
      detailedMessages: { lock }
    });
    Utils.isDevelopmentEnv() && console.debug(chalk.green(`Released the lock entity '${lock.entity}' ('${lock.key}') of type '${lock.type}' in Tenant ID '${lock.tenantID}'`));
    return true;
  }

  public static async cleanupLocks(doCleanup = true): Promise<void> {
    if (doCleanup) {
      const hostname = Utils.getHostname();
      await LockingStorage.deleteLockByHostname(hostname);
    }
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
      hostname: Utils.getHostname()
    };
  }
}
