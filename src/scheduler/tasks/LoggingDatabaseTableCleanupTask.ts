import moment from 'moment';
import Logging from '../../utils/Logging';
import LoggingStorage from '../../storage/mongodb/LoggingStorage';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../TaskConfig';
import Tenant from '../../entity/Tenant';

export default class LoggingDatabaseTableCleanupTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      Logging.logInfo({
        tenantID: tenant.getID(),
        module: 'LoggingDatabaseTableCleanupTask',
        method: 'run', action: 'LogsCleanup',
        message: 'The task \'loggingDatabaseTableCleanupTask\' is being run'
      });

      // Delete date
      const deleteUpToDate = moment().subtract(config.retentionPeriodWeeks, 'w').startOf('week').toDate().toISOString();
      // Delete
      let result = await LoggingStorage.deleteLogs(tenant.getID(), deleteUpToDate);
      // Ok?
      if (result.ok === 1) {
        // Ok
        Logging.logSecurityInfo({
          tenantID: tenant.getID(),
          module: 'LoggingDatabaseTableCleanupTask',
          method: 'run', action: 'LogsCleanup',
          message: `${result.n} Log(s) have been deleted before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`
        });
      } else {
        // Error
        Logging.logError({
          tenantID: tenant.getID(),
          module: 'LoggingDatabaseTableCleanupTask',
          method: 'run', action: 'LogsCleanup',
          message: `An error occurred when deleting Logs before '${moment(deleteUpToDate).format('DD/MM/YYYY h:mm A')}'`,
          detailedMessages: result
        });
      }
      // Delete date
      const securityDeleteUpToDate = moment().subtract(config.securityRetentionPeriodWeeks, 'w').startOf('week').toDate().toISOString();
      // Delete Security Logs
      result = await LoggingStorage.deleteSecurityLogs(tenant.getID(), securityDeleteUpToDate);
      // Ok?
      if (result.ok === 1) {
        // Ok
        Logging.logSecurityInfo({
          tenantID: tenant.getID(),
          module: 'LoggingDatabaseTableCleanupTask',
          method: 'run', action: 'LogsCleanup',
          message: `${result.n} Security Log(s) have been deleted before '${moment(securityDeleteUpToDate).format('DD/MM/YYYY h:mm A')}'`
        });
      } else {
        // Error
        Logging.logSecurityError({
          tenantID: tenant.getID(),
          module: 'LoggingDatabaseTableCleanupTask',
          method: 'run', action: 'LogsCleanup',
          message: `An error occurred when deleting Security Logs before '${moment(securityDeleteUpToDate).format('DD/MM/YYYY h:mm A')}'`,
          detailedMessages: result
        });
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.getID(), 'LogsCleanup', error);
    }
  }
}

