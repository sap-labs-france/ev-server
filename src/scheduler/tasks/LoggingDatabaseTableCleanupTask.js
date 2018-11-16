const Logging = require('../../utils/Logging');
const moment = require('moment');
const SchedulerTask = require('../SchedulerTask');
const LoggingStorage = require('../../storage/mongodb/LoggingStorage');
const Tenant = require('../../entity/Tenant');

class LoggingDatabaseTableCleanupTask extends SchedulerTask {
  constructor() {
    super();
  }

  async run(config) {
    const tenants = await Tenant.getTenants();
    for (const tenant of tenants) {
      LoggingDatabaseTableCleanupTask.processTenant(tenant, config);
    }
  }

  static async processTenant(tenant, config) {
    try {
      Logging.logInfo({
        tenantID: tenant.getID(),
        module: "LoggingDatabaseTableCleanupTask",
        method: "run", action: "LogsCleanup",
        message: `The task 'loggingDatabaseTableCleanupTask' is being run`
      });

      // Delete date
      const deleteUpToDate = moment().subtract(config.retentionPeriodWeeks, "w").startOf("week").toDate().toISOString();
      // Delete
      let result = await LoggingStorage.deleteLogs(tenant.getID(), deleteUpToDate);
      // Ok?
      if (result.ok === 1) {
        // Ok
        Logging.logSecurityInfo({
          tenantID: tenant.getID(),
          module: "LoggingDatabaseTableCleanupTask",
          method: "run", action: "LogsCleanup",
          message: `${result.n} Log(s) have been deleted before '${moment(deleteUpToDate).format("DD/MM/YYYY h:mm A")}'`
        });
      } else {
        // Error
        Logging.logError({
          tenantID: tenant.getID(),
          module: "LoggingDatabaseTableCleanupTask",
          method: "run", action: "LogsCleanup",
          message: `An error occurred when deleting Logs before '${moment(deleteUpToDate).format("DD/MM/YYYY h:mm A")}'`,
          detailedMessages: result
        });
      }
      // Delete date
      const securityDeleteUpToDate = moment().subtract(config.securityRetentionPeriodWeeks, "w").startOf("week").toDate().toISOString();
      // Delete Security Logs
      result = await LoggingStorage.deleteSecurityLogs(tenant.getID(), securityDeleteUpToDate);
      // Ok?
      if (result.ok === 1) {
        // Ok
        Logging.logSecurityInfo({
          tenantID: tenant.getID(),
          module: "LoggingDatabaseTableCleanupTask",
          method: "run", action: "LogsCleanup",
          message: `${result.n} Security Log(s) have been deleted before '${moment(securityDeleteUpToDate).format("DD/MM/YYYY h:mm A")}'`
        });
      } else {
        // Error
        Logging.logSecurityError({
          tenantID: tenant.getID(),
          module: "LoggingDatabaseTableCleanupTask",
          method: "run", action: "LogsCleanup",
          message: `An error occurred when deleting Security Logs before '${moment(securityDeleteUpToDate).format("DD/MM/YYYY h:mm A")}'`,
          detailedMessages: result
        });
      }
    } catch (error) {
      // Log error
      Logging.logActionExceptionMessage(tenant.getID(), "LogsCleanup", error);
    }
  }
}

module.exports = LoggingDatabaseTableCleanupTask;
