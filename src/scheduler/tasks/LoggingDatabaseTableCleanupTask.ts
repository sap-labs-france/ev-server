import { LoggingDatabaseTableCleanupTaskConfig, TaskConfig } from '../../types/TaskConfig';

import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import Logging from '../../utils/Logging';
import LoggingStorage from '../../storage/mongodb/LoggingStorage';
import PerformanceStorage from '../../storage/mongodb/PerformanceStorage';
import SchedulerTask from '../SchedulerTask';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import global from './../../types/GlobalType';
import moment from 'moment';

const MODULE_NAME = 'LoggingDatabaseTableCleanupTask';

export default class LoggingDatabaseTableCleanupTask extends SchedulerTask {
  public async run(name: string, config: TaskConfig): Promise<void> {
    // Delete Default Tenant Logs
    await this.deleteLogs(Constants.DEFAULT_TENANT_OBJECT);
    // Delete Default Tenant Perfs Records
    await this.deletePerformanceRecords(Constants.DEFAULT_TENANT_OBJECT);
    // Call for all Tenants
    await super.run(name, config);
  }

  async processTenant(tenant: Tenant, config: LoggingDatabaseTableCleanupTaskConfig): Promise<void> {
    // Delete Tenant Logs
    await this.deleteLogs(tenant);
  }

  private async deleteLogs(tenant: Tenant) {
    // Get the lock
    const logsCleanUpLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.LOGGING, 'cleanup');
    if (await LockingManager.acquire(logsCleanUpLock)) {
      try {
        const lastLogMDB = global.database.getCollection(tenant.id, 'logs').find({})
          .sort({ timestamp: -1 })
          .skip(10 * 1000 * 1000)
          .limit(1)
          .project({ timestamp: 1 });
        const lastLog = await lastLogMDB.toArray();
        if (lastLog.length > 0) {
          // Delete Standard Logs
          const deleteUpToDate = lastLog[0].timestamp as Date;
          // Delete
          const result = await LoggingStorage.deleteLogs(tenant, deleteUpToDate);
          // Ok?
          if (result.acknowledged) {
            await Logging.logSecurityInfo({
              tenantID: tenant.id,
              action: ServerAction.LOGS_CLEANUP,
              module: MODULE_NAME, method: 'deleteLogs',
              message: `${result.deletedCount} Log(s) have been deleted successfully before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`
            });
          } else {
            await Logging.logError({
              tenantID: tenant.id,
              action: ServerAction.LOGS_CLEANUP,
              module: MODULE_NAME, method: 'deleteLogs',
              message: `An error occurred when deleting Logs before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`,
              detailedMessages: { result }
            });
          }
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.LOGS_CLEANUP, error);
      } finally {
        await LockingManager.release(logsCleanUpLock);
      }
    }
  }

  private async deletePerformanceRecords(tenant: Tenant) {
    // Get the lock
    const performanceCleanUpLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.PERFORMANCE, 'cleanup');
    if (await LockingManager.acquire(performanceCleanUpLock)) {
      try {
        const lastLogMDB = global.database.getCollection(tenant.id, 'performances').find({})
          .sort({ timestamp: -1 })
          .skip(20 * 1000 * 1000)
          .limit(1)
          .project({ timestamp: 1 });
        const lastLog = await lastLogMDB.toArray();
        if (lastLog.length > 0) {
          // Delete Standard Logs
          const deleteUpToDate = lastLog[0].timestamp as Date;
          // Delete
          const result = await PerformanceStorage.deletePerformanceRecords({ deleteUpToDate });
          // Ok?
          if (result.acknowledged) {
            await Logging.logSecurityInfo({
              tenantID: tenant.id,
              action: ServerAction.PERFORMANCES_CLEANUP,
              module: MODULE_NAME, method: 'deletePerformanceRecords',
              message: `${result.deletedCount} Performance Record(s) have been deleted successfully before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`
            });
          } else {
            await Logging.logError({
              tenantID: tenant.id,
              action: ServerAction.PERFORMANCES_CLEANUP,
              module: MODULE_NAME, method: 'deletePerformanceRecords',
              message: `An error occurred when deleting Performance Record(s) before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`,
              detailedMessages: { result }
            });
          }
        }
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.PERFORMANCES_CLEANUP, error);
      } finally {
        // Release the lock
        await LockingManager.release(performanceCleanUpLock);
      }
    }
  }
}

