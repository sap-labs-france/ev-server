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
import moment from 'moment';

const MODULE_NAME = 'LoggingDatabaseTableCleanupTask';

export default class LoggingDatabaseTableCleanupTask extends SchedulerTask {
  public async run(name: string, config: TaskConfig): Promise<void> {
    // Delete
    await this.deleteLogs(Constants.DEFAULT_TENANT, config);
    // Delete Perfs Records
    await this.deletePerformanceRecords(Constants.DEFAULT_TENANT, config);
    // Call for all Tenants
    await super.run(name, config);
  }

  async processTenant(tenant: Tenant, config: LoggingDatabaseTableCleanupTaskConfig): Promise<void> {
    // Delete Logs
    await this.deleteLogs(tenant.id, config);
  }

  private async deleteLogs(tenantID: string, config: LoggingDatabaseTableCleanupTaskConfig) {
    // Get the lock
    const logsCleanUpLock = LockingManager.createExclusiveLock(tenantID, LockEntity.LOGGING, 'cleanup');
    if (await LockingManager.acquire(logsCleanUpLock)) {
      try {
        // Delete Standard Logs
        const deleteUpToDate = moment().subtract(config.retentionPeriodWeeks, 'w').startOf('week').toDate();
        // Delete
        let result = await LoggingStorage.deleteLogs(tenantID, deleteUpToDate);
        // Ok?
        if (result.ok === 1) {
          await Logging.logSecurityInfo({
            tenantID: tenantID,
            action: ServerAction.LOGS_CLEANUP,
            module: MODULE_NAME, method: 'deleteLogs',
            message: `${result.n} Log(s) have been deleted successfully before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`
          });
        } else {
          await Logging.logError({
            tenantID: tenantID,
            action: ServerAction.LOGS_CLEANUP,
            module: MODULE_NAME, method: 'deleteLogs',
            message: `An error occurred when deleting Logs before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`,
            detailedMessages: { result }
          });
        }
        // Delete Security Logs
        const securityDeleteUpToDate: Date = moment().subtract(config.securityRetentionPeriodWeeks, 'w').startOf('week').toDate();
        // Delete
        result = await LoggingStorage.deleteSecurityLogs(tenantID, securityDeleteUpToDate);
        // Ok?
        if (result.ok === 1) {
          await Logging.logSecurityInfo({
            tenantID: tenantID,
            action: ServerAction.LOGS_CLEANUP,
            module: MODULE_NAME, method: 'deleteLogs',
            message: `${result.n} Security Log(s) have been deleted before '${moment(securityDeleteUpToDate).format('DD/MM/YYYY h:mm A')}'`
          });
        } else {
          await Logging.logSecurityError({
            tenantID: tenantID,
            action: ServerAction.LOGS_CLEANUP,
            module: MODULE_NAME, method: 'deleteLogs',
            message: `An error occurred when deleting Security Logs before '${moment(securityDeleteUpToDate).format('DD/MM/YYYY h:mm A')}'`,
            detailedMessages: { result }
          });
        }
      } catch (error) {
        await Logging.logActionExceptionMessage(tenantID, ServerAction.LOGS_CLEANUP, error);
      } finally {
        await LockingManager.release(logsCleanUpLock);
      }
    }
  }

  private async deletePerformanceRecords(tenantID: string, config: LoggingDatabaseTableCleanupTaskConfig) {
    // Get the lock
    const performanceCleanUpLock = LockingManager.createExclusiveLock(tenantID, LockEntity.PERFORMANCE, 'cleanup');
    if (await LockingManager.acquire(performanceCleanUpLock)) {
      try {
        // Delete Performance Records
        const deleteUpToDate = moment().subtract(config.retentionPeriodWeeks, 'w').startOf('week').toDate();
        // Delete
        const result = await PerformanceStorage.deletePerformanceRecords({ deleteUpToDate });
        // Ok?
        if (result.ok === 1) {
          await Logging.logSecurityInfo({
            tenantID: tenantID,
            action: ServerAction.PERFORMANCES_CLEANUP,
            module: MODULE_NAME, method: 'deletePerformanceRecords',
            message: `${result.n} Performance Record(s) have been deleted successfully before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`
          });
        } else {
          await Logging.logError({
            tenantID: tenantID,
            action: ServerAction.PERFORMANCES_CLEANUP,
            module: MODULE_NAME, method: 'deletePerformanceRecords',
            message: `An error occurred when deleting Performance Record(s) before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`,
            detailedMessages: { result }
          });
        }
      } catch (error) {
        // Log error
        await Logging.logActionExceptionMessage(tenantID, ServerAction.PERFORMANCES_CLEANUP, error);
      } finally {
        // Release the lock
        await LockingManager.release(performanceCleanUpLock);
      }
    }
  }
}

