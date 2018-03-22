const Logging = require('../utils/Logging');
const UpdateTransactionInactivityTask = require('./tasks/UpdateTransactionInactivityTask');
const DummyTask = require('./tasks/DummyTask');
const moment = require('moment');

class MigrationHandler {
	// Migrate method
	static migrate() {
		// Return
		return new Promise((fulfill, reject) => {
			let startMigrationTime = moment();
			let currentMigrationTasks=[];
			let executionMigrationTasks=[];

			// Create tasks
			currentMigrationTasks.push(new UpdateTransactionInactivityTask());
			currentMigrationTasks.push(new DummyTask());

			// Log
			Logging.logInfo({
				source: "Migration", action: "Migration",
				module: "MigrationHandler", method: "migrate",
				message: `Checking migration tasks...` });
			// Get the already done migrations from the DB
			global.storage.getMigrations().then((migrationTasksDone) => {
				let proms = [];
				// Check
				currentMigrationTasks.forEach((currentMigrationTask) => {
					// Check if not already done
					let migrationTaskDone = migrationTasksDone.find((migrationTaskDone) => {
						// Same name and version
						return ((currentMigrationTask.getName() == migrationTaskDone.name) &&
							(currentMigrationTask.getVersion() == migrationTaskDone.version))
					});
					// Already processed?
					if (migrationTaskDone) {
						// Yes
						Logging.logInfo({
							source: "Migration", action: "Migration",
							module: "MigrationHandler", method: "migrate",
							message: `Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has already been processed` });
					} else {
						// Add to execution list
						executionMigrationTasks.push(currentMigrationTask);

						// Log Start Task
						Logging.logInfo({
							source: "Migration", action: "Migration",
							module: "MigrationHandler", method: "migrate",
							message: `Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running...` });
						// Log in the console also
						console.log(`Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running...`);
						// Push for run migration
						proms.push(currentMigrationTask.migrate());
					}
				});
				// Execute all migrations
				return Promise.all(proms);
			}).then((results) => {
				let promsSaveDB = [];
				// Process each executed Task
				results.forEach((result, index) => {
					// Get the executed task
					let currentTask = executionMigrationTasks[index];
					Logging.logInfo({
						source: "Migration", action: "Migration",
						module: "MigrationHandler", method: "migrate",
						message: `Task '${currentTask.getName()}' Version '${currentTask.getVersion()}' has run with success in ${result.totalTaskTimeSecs} secs` });
					// Log in the console also
					console.log(`Migration Task '${currentTask.getName()}' Version '${currentTask.getVersion()}' has run with success in ${result.totalTaskTimeSecs} secs`);
					// Save to the DB
					// Save the migration
					promsSaveDB.push(global.storage.saveMigration({
						name: currentTask.getName(),
						version: currentTask.getVersion(),
						timestamp: new Date(),
						durationSecs: result.totalTaskTimeSecs
					}));
				});
				// Execute all migrations
				return Promise.all(promsSaveDB);
			}).then((results) => {
				// Log Start Task
				let totalMigrationTimeSecs = moment.duration(moment().diff(startMigrationTime)).asSeconds();
				Logging.logInfo({
					source: "Migration", action: "Migration",
					module: "MigrationHandler", method: "migrate",
					message: `All migration tasks have been run with success in ${totalMigrationTimeSecs} secs`,
					detailedMessages: results });
				// Ok
				fulfill(results);
			}).catch((error) => {
				// Log in the console also
				console.log(error);
				// Log
				Logging.logError({
					source: "Migration", action: "Migration",
					module: "MigrationHandler", method: "migrate",
					message: error.toString(),
					detailedMessages: error });
				// Error
				reject(error);
			});
		});
	}
}
module.exports=MigrationHandler;
