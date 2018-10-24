const Logging = require('../utils/Logging');
const DummyTask = require('./tasks/DummyTask');
const moment = require('moment');
const MigrationStorage = require('../storage/mongodb/MigrationStorage')
const UpdateTransactionInactivityTask = require('./tasks/UpdateTransactionInactivityTask');

class MigrationHandler {
	// Migrate method
	static async migrate() {
		try {
			let startMigrationTime = moment();
			let currentMigrationTasks=[];

			// Log
			Logging.logInfo({
				source: "Migration", action: "Migration",
				module: "MigrationHandler", method: "migrate",
				message: `Checking migration tasks...` });

			// Create tasks
			currentMigrationTasks.push(new DummyTask());
			currentMigrationTasks.push(new UpdateTransactionInactivityTask());

			// Get the already done migrations from the DB
			let migrationTasksDone = await MigrationStorage.getMigrations();

			// Check
			for (const currentMigrationTask of currentMigrationTasks) {
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
					// Continue
					continue;
				}
				// Execute Migration Task
				// Log Start Task
				Logging.logInfo({
					source: "Migration", action: "Migration",
					module: "MigrationHandler", method: "migrate",
					message: `Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running...` });
				// Log in the console also
				console.log(`Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' is running...`);

				// Start time
				let startTaskTime = moment();

				// Execute Migration
				await currentMigrationTask.migrate();
					
				// End time
				let totalTaskTimeSecs = moment.duration(moment().diff(startTaskTime)).asSeconds();

				// End
				Logging.logInfo({
					source: "Migration", action: "Migration",
					module: "MigrationHandler", method: "migrate",
					message: `Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs` });
				// Log in the console also
				console.log(`Migration Task '${currentMigrationTask.getName()}' Version '${currentMigrationTask.getVersion()}' has run with success in ${totalTaskTimeSecs} secs`);

				// Save to the DB
				await MigrationStorage.saveMigration({
					name: currentMigrationTask.getName(),
					version: currentMigrationTask.getVersion(),
					timestamp: new Date(),
					durationSecs: totalTaskTimeSecs
				});
			}
			// Log Total Processing Time
			let totalMigrationTimeSecs = moment.duration(moment().diff(startMigrationTime)).asSeconds();
			Logging.logInfo({
				source: "Migration", action: "Migration",
				module: "MigrationHandler", method: "migrate",
				message: `All migration tasks have been run with success in ${totalMigrationTimeSecs} secs` });
		} catch (error) {
			// Log in the console also
			console.log(error);
			// Log
			Logging.logError({
				source: "Migration", action: "Migration",
				module: "MigrationHandler", method: "migrate",
				message: error.toString(),
				detailedMessages: error });
		};
	}
}
module.exports=MigrationHandler;
