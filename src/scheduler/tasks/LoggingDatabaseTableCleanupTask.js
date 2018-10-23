const Logging = require('../../utils/Logging');
const moment = require('moment');
const SchedulerTask = require('../SchedulerTask');
const LoggingStorage = require('../../storage/mongodb/LoggingStorage');

class LoggingDatabaseTableCleanupTask extends SchedulerTask {
	constructor() {
		super();
	}

	async run(tenantID, config) {
		try {
			Logging.logInfo({
				module: "LoggingDatabaseTableCleanupTask",
				method: "run", action: "LogsCleanup",
				message: `The task 'loggingDatabaseTableCleanupTask' is being run` });

			// Delete date
			let deleteUpToDate = moment().subtract(config.retentionPeriodWeeks, "w").startOf("week").toDate().toISOString();
			// Delete
			let result = await LoggingStorage.deleteLogs(tenantID, deleteUpToDate);
			// Ok?
			if (result.ok === 1) {
				// Ok
				Logging.logSecurityInfo({
					module: "LoggingDatabaseTableCleanupTask",
					method: "run", action: "LogsCleanup",
					message: `${result.n} Log(s) have been deleted before '${moment(deleteUpToDate).format("DD/MM/YYYY h:mm A")}'`
				});
			} else {
				// Error
				Logging.logError({
					module: "LoggingDatabaseTableCleanupTask",
					method: "run", action: "LogsCleanup",
					message: `An error occurred when deleting Logs before '${moment(deleteUpToDate).format("DD/MM/YYYY h:mm A")}'`,
					detailedMessages: result
				});
			}
			// Delete date
			let securityDeleteUpToDate = moment().subtract(config.securityRetentionPeriodWeeks, "w").startOf("week").toDate().toISOString();
			// Delete Security Logs
			result = await LoggingStorage.deleteSecurityLogs(tenantID, securityDeleteUpToDate);
			// Ok?
			if (result.ok === 1) {
				// Ok
				Logging.logSecurityInfo({
					module: "LoggingDatabaseTableCleanupTask",
					method: "run", action: "LogsCleanup",
					message: `${result.n} Security Log(s) have been deleted before '${moment(securityDeleteUpToDate).format("DD/MM/YYYY h:mm A")}'`
				});
			} else {
				// Error
				Logging.logSecurityError({
					module: "LoggingDatabaseTableCleanupTask",
					method: "run", action: "LogsCleanup",
					message: `An error occurred when deleting Security Logs before '${moment(securityDeleteUpToDate).format("DD/MM/YYYY h:mm A")}'`,
				 	detailedMessages: result
				});
			}
		} catch(error) {
			// Log error
			Logging.logActionExceptionMessage("LogsCleanup", error);
		}
	}
}

module.exports=LoggingDatabaseTableCleanupTask;
