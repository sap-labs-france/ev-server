import cfenv from 'cfenv';
import os from 'os';
import LockingStorage from '../storage/mongodb/LockingStorage';
import { Action } from '../types/Authorization';
import LockType from '../types/Lock';
import Configuration from './Configuration';
import Constants from './Constants';
import Cypher from './Cypher';
import Logging from './Logging';

const MODULE_NAME = 'Lock';

/**
 * Namespace based runtime locking primitive with a DB storage for sharing purpose among different hosts.
 * Implemented lock type:
 *  - 'E' = mutually exclusive
 */
export default class Lock implements LockType {
  public keyHash: string;
  public name: string;
  public type: string;
  public timestamp: Date;
  public hostname: string;
  public onMultipleHosts: boolean;

  public constructor(name: string, type = 'E', onMultipleHosts = true) {
    if (!name) {
      const logMsg = 'Lock must have a unique name';
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME, method: 'constructor',
        action: Action.LOCKING,
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      return;
    }
    this.keyHash = Cypher.hash(name.toLowerCase() + '~' + type);
    this.name = name.toLowerCase();
    this.type = type,
    this.timestamp = new Date();
    this.hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    this.onMultipleHosts = onMultipleHosts;
  }

  public async acquire(): Promise<void> {
    if (!await LockingStorage.getLockStatus(this, this.onMultipleHosts)) {
      await LockingStorage.saveLock(this);
    }
  }

  public async tryAcquire(): Promise<boolean> {
    if (await LockingStorage.getLockStatus(this, this.onMultipleHosts)) {
      return false;
    }
    await LockingStorage.saveLock(this);
    return true;
  }

  public async release(): Promise<void> {
    if (!await LockingStorage.getLockStatus(this, this.onMultipleHosts)) {
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
    await LockingStorage.deleteLock(this);
  }
}
