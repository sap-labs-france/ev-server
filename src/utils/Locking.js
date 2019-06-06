const Constants = require('./Constants');
const LockingStorage = require('../storage/mongodb/LockingStorage');
const Database = require('./Database');
const Logging = require('./Logging');

/**
 * Namespace based mutually exclusive runtime locking primitive with a DB storage 
 * for sharing purpose among different hosts.
 */
class RunLock {
  constructor(name, onMultipleHosts = true) {
    this._MODULE_NAME = 'RunLock';
    if (!name) {
      const logMsg = `RunLock must have a unique name`;
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: this._MODULE_NAME,
        method: "constructor",
        action: "LockingError",
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      return;
    }
    this._onMultipleHosts = onMultipleHosts;
    this._runLock = {};
    Database.updateRunLock({ name: name, timestamp: new Date() }, this._runLock, false);
  }

  async acquire() {
    if (!await LockingStorage.getLockStatus(this._runLock, this._onMultipleHosts))
      await LockingStorage.saveRunLock(this._runLock);
  }

  async tryAcquire() {
    if (await LockingStorage.getLockStatus(this._runLock, this._onMultipleHosts)) {
      return false;
    }

    await LockingStorage.saveRunLock(this._runLock);
    return true;
  }

  async timedAcquire(duration = 60) { }

  async tryTimedAcquire(duration = 60) { }

  async release() {
    if (!await LockingStorage.getLockStatus(this._runLock, this._onMultipleHosts)) {
      const logMsg = `RunLock ${this._runLock.name} is not acquired`;
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        module: this._MODULE_NAME,
        method: "release",
        action: "LockingError",
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      return;
    }
    await LockingStorage.deleteRunLock(this._runLock);
  }
}

module.exports = RunLock;