const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const MDBMigration = require('../model/MDBMigration');
const crypto = require('crypto');

let _db;

class MigrationStorage {
	static setDatabase(db) {
		_db = db;
	}

	static handleGetMigrations() {
		// Exec request
		return MDBMigration.find({}).exec().then((migrationsMDB) => {
			let migrations = [];
			// Create
			migrationsMDB.forEach((migrationMDB) => {
				let migration = {};
				// Set values
				Database.updateMigration(migrationMDB, migration);
				// Add
				migrations.push(migration);
			});
			// Ok
			return migrations;
		});
	}

	static handleSaveMigrations(migration) {
		// Create model
		let migrationMDB = new MDBMigration(migration);
		// Set the ID
		migrationMDB._id = migration.name + "~" + migration.version;
		// Create new
		return migrationMDB.save();
	}
}

module.exports = MigrationStorage;
