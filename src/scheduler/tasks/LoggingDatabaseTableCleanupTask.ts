import { LoggingDatabaseTableCleanupTaskConfig, TaskConfig } from '../../types/TaskConfig';

import Constants from '../../utils/Constants';
import { LockEntity } from '../../types/Locking';
import LockingManager from '../../locking/LockingManager';
import LogStorage from '../../storage/mongodb/LogStorage';
import Logging from '../../utils/Logging';
import PerformanceStorage from '../../storage/mongodb/PerformanceStorage';
import { ServerAction } from '../../types/Server';
import Tenant from '../../types/Tenant';
import TenantSchedulerTask from '../TenantSchedulerTask';
import global from './../../types/GlobalType';
import moment from 'moment';

const MODULE_NAME = 'LoggingDatabaseTableCleanupTask';

export default class LoggingDatabaseTableCleanupTask extends TenantSchedulerTask {
  public async beforeTaskRun(config: TaskConfig): Promise<void> {
    // Delete Default Tenant Logs
    await this.deleteLogs(Constants.DEFAULT_TENANT_OBJECT, config);
    // Delete Default Tenant Perfs Records
    await this.deletePerformanceRecords(Constants.DEFAULT_TENANT_OBJECT, config);
  }

  public async processTenant(tenant: Tenant, config: LoggingDatabaseTableCleanupTaskConfig): Promise<void> {
    // Delete Tenant Logs
    await this.deleteLogs(tenant, config);
  }

  private async deleteLogs(tenant: Tenant, config: LoggingDatabaseTableCleanupTaskConfig) {
    // Get the lock
    const logsCleanUpLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.LOG, 'cleanup');
    if (await LockingManager.acquire(logsCleanUpLock)) {
      try {
        const lastLogMDB = global.database.getCollection<any>(tenant.id, 'logs').find({})
          .sort({ timestamp: -1 })
          .skip(10 * 1000 * 1000)
          .limit(1)
          .project({ timestamp: 1 });
        const lastLog = await lastLogMDB.toArray();
        let deleteUpToDate: Date;
        if (lastLog.length > 0) {
          deleteUpToDate = lastLog[0].timestamp as Date;
        } else {
          deleteUpToDate = moment().subtract(config.retentionPeriodWeeks, 'w').toDate();
        }
        // Delete
        const result = await LogStorage.deleteLogs(tenant, deleteUpToDate);
        if (result.acknowledged) {
          await Logging.logInfo({
            tenantID: tenant.id,
            action: ServerAction.LOGS_CLEANUP,
            module: MODULE_NAME, method: 'deleteLogs',
            message: `${result.deletedCount} Log(s) have been deleted before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`
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
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.LOGS_CLEANUP, error);
      } finally {
        await LockingManager.release(logsCleanUpLock);
      }
    }
  }

  private async deletePerformanceRecords(tenant: Tenant, config: LoggingDatabaseTableCleanupTaskConfig) {
    // Get the lock
    const performanceCleanUpLock = LockingManager.createExclusiveLock(tenant.id, LockEntity.PERFORMANCE, 'cleanup');
    if (await LockingManager.acquire(performanceCleanUpLock)) {
      try {
        const lastLogMDB = global.database.getCollection<any>(tenant.id, 'performances').find({})
          .sort({ timestamp: -1 })
          .skip(25 * 1000 * 1000)
          .limit(1)
          .project({ timestamp: 1 });
        const lastLog = await lastLogMDB.toArray();
        let deleteUpToDate: Date;
        if (lastLog.length > 0) {
          deleteUpToDate = lastLog[0].timestamp as Date;
        } else {
          deleteUpToDate = moment().subtract(config.retentionPeriodWeeks, 'w').toDate();
        }
        // Delete Logs
        const result = await PerformanceStorage.deletePerformanceRecords({ deleteUpToDate });
        if (result.acknowledged) {
          await Logging.logInfo({
            tenantID: tenant.id,
            action: ServerAction.PERFORMANCES_CLEANUP,
            module: MODULE_NAME, method: 'deletePerformanceRecords',
            message: `${result.deletedCount} Performance Record(s) have been deleted before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`
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
      } catch (error) {
        await Logging.logActionExceptionMessage(tenant.id, ServerAction.PERFORMANCES_CLEANUP, error);
      } finally {
        // Release the lock
        await LockingManager.release(performanceCleanUpLock);
      }
    }
  }
}
