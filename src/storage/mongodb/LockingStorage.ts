import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import Lock from '../../types/Locking';
import Logging from '../../utils/Logging';
import Utils from '../../utils/Utils';
import global from '../../types/GlobalType';

const MODULE_NAME = 'LockingStorage';

export default class LockingStorage {
  public static async getLocks(): Promise<Lock[]> {
    // Debug
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'getLocks');
    const aggregation = [];
    // Handle the ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    DatabaseUtils.pushConvertObjectIDToString(aggregation, 'tenantID');
    // Read DB
    const locksMDB = await global.database.getCollection<Lock>(Constants.DEFAULT_TENANT, 'locks')
      .aggregate(aggregation)
      .toArray();
    // Debug
    Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'getLocks', uniqueTimerID, locksMDB);
    // Ok
    return locksMDB;
  }

  public static async insertLock(lockToSave: Lock): Promise<void> {
    // Debug
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'insertLock');
    // Transfer
    const lockMDB = {
      _id: lockToSave.id,
      tenantID: lockToSave.tenantID !== Constants.DEFAULT_TENANT ? Utils.convertToObjectID(lockToSave.tenantID) : null,
      entity: lockToSave.entity,
      key: lockToSave.key,
      type: lockToSave.type,
      timestamp: Utils.convertToDate(lockToSave.timestamp),
      hostname: lockToSave.hostname
    };
    // Create
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .insertOne(lockMDB);
    // Debug
    Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'insertLock', uniqueTimerID, lockToSave);
  }

  public static async deleteLock(lockToDelete: Lock): Promise<boolean> {
    // Debug
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'deleteLock');
    // Delete
    const result = await global.database.getCollection<any>(Constants.DEFAULT_TENANT, 'locks')
      .findOneAndDelete({ '_id': lockToDelete.id });
    // Debug
    Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'deleteLock', uniqueTimerID, result);
    return result.value !== null;
  }
}
