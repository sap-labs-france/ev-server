import cfenv from 'cfenv';
import os from 'os';
import LockingStorage from '../storage/mongodb/LockingStorage';
import Lock from '../types/Lock';
import Configuration from './Configuration';
import Constants from './Constants';
import Cypher from './Cypher';
import Logging from './Logging';

const MODULE_NAME = 'RunLock';

/**
 * Namespace based mutually exclusive runtime locking primitive with a DB storage
 * for sharing purpose among different hosts.
 */
export default class RunLock {
  private _runLock: Lock;
  private _onMultipleHosts: boolean;

  public constructor(name: string, onMultipleHosts = true) {
    if (!name) {
      const logMsg = 'RunLock must have a unique name';
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: 'constructor',
        action: 'Locking',
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      return;
    }
    this._onMultipleHosts = onMultipleHosts;
    this._runLock = {
      lockHashId: Cypher.hash(name.toLowerCase() + '~runLock'),
      name: name.toLowerCase(),
      type: 'runLock',
      timestamp: new Date(),
      hostname: Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname()
    };
  }

  public async acquire(): Promise<void> {
    if (!await LockingStorage.getLockStatus(this._runLock, this._onMultipleHosts)) {
      await LockingStorage.saveRunLock(this._runLock);
    }
  }

  public async tryAcquire(): Promise<boolean> {
    if (await LockingStorage.getLockStatus(this._runLock, this._onMultipleHosts)) {
      return false;
    }
    await LockingStorage.saveRunLock(this._runLock);
    return true;
  }

  public async timedAcquire(duration = 60) { }

  public async tryTimedAcquire(duration = 60) { }

  public async release(): Promise<void> {
    if (!await LockingStorage.getLockStatus(this._runLock, this._onMultipleHosts)) {
      const logMsg = `RunLock ${this._runLock.name} is not acquired`;
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: 'release',
        action: 'LockingError',
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      return;
    }
    await LockingStorage.deleteRunLock(this._runLock.lockHashId);
  }
}
