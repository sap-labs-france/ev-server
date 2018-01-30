const MongoDBStorage = require('./storage/mongodb/MongoDBStorage');
const Configuration = require('./utils/Configuration');
const Users = require('./utils/Users');
const SoapCentralSystemServer = require('./server/charging-station/soap/SoapCentralSystemServer');
const CentralRestServer = require('./server/front-end/CentralRestServer');
const SchedulerManager = require('./scheduler/SchedulerManager');
const MigrationHandler = require('./migration/MigrationHandler');
const Logging = require('./utils/Logging');

require('source-map-support').install();

// Start the connection to the Database
let storageConfig = Configuration.getStorageConfig();

let nodejs_env = process.env.NODE_ENV || 'dev';
console.log(`NodeJS is started in '${nodejs_env}' mode`);

// Check implementation
switch (storageConfig.implementation) {
	// MongoDB?
	case 'mongodb':
			// Create MongoDB
		let mongoDB = new MongoDBStorage(storageConfig);
		// Set global var
		global.storage = mongoDB;
		break;

	default:
		console.log(`Storage Server implementation '${storageConfig.implementation}' not supported!`);
}

// -----------------------------------------------------------------------------
// Start the DB
// -----------------------------------------------------------------------------
global.storage.start().then(() => {
	// Log
	Logging.logInfo({
		module: "Bootstrap", method: "start", action: "Startup",
		message: `Connected successfully to '${storageConfig.implementation}' on '${storageConfig.host}:${storageConfig.port}', schema '${storageConfig.schema}', user '${storageConfig.user}'` });
	console.log(`Connected successfully to '${storageConfig.implementation}' on '${storageConfig.host}:${storageConfig.port}', schema '${storageConfig.schema}',  user '${storageConfig.user}'`);

	// ---------------------------------------------------------------------------
	// Check and trigger migration
	// ---------------------------------------------------------------------------
	MigrationHandler.migrate().then((results) => {
		// ---------------------------------------------------------------------------
		// Import Users
		// ---------------------------------------------------------------------------
		try {
			// Import users
			Users.importUsers();
		} catch (err) {
			// Log
			Logging.logError({
				module: "ImportUsersTask",
				method: "run", message: `Cannot import users: ${err.toString()}`,
				detailedMessages: err.stack });
		}

		// -------------------------------------------------------------------------
		// Create the Central Systems (Charging Stations)
		// -------------------------------------------------------------------------
		let centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
		let centralSystemsConfig = Configuration.getCentralSystemsConfig();
		let chargingStationConfig = Configuration.getChargingStationConfig();
		let advancedConfig = Configuration.getAdvancedConfig();

		// -------------------------------------------------------------------------
		// Start the Central Rest System (Front-end REST service)
		// -------------------------------------------------------------------------
		// Provided?
		if (centralSystemRestConfig) {
			// Create the server
			let centralRestServer = new CentralRestServer(centralSystemRestConfig);
			// Set to database for Web Socket Notifications
			global.storage.setCentralRestServer(centralRestServer);
			// Start it
			centralRestServer.start();
		}

		// -------------------------------------------------------------------------
		// Instanciate central servers
		// -------------------------------------------------------------------------
		centralSystemsConfig.forEach((centralSystemConfig) => {
			let centralSystemServer;
			// Check implementation
			switch (centralSystemConfig.implementation) {
				// SOAP
				case 'soap':
					// Create implementation
					centralSystemServer = new SoapCentralSystemServer(centralSystemConfig, chargingStationConfig);
					// Start
					centralSystemServer.start();
					break;
				default:
					console.log(`Central System Server implementation '${centralSystemConfig.implementation}' not found!`);
			}
		});

		// -------------------------------------------------------------------------
		// Start the Scheduler
		// -------------------------------------------------------------------------
		SchedulerManager.init();
	}).catch((error) => {
		// Log
		Logging.logError({
			source: "BootStrap", module: "start", method: "-", action: "Migrate",
			message: `Error occurred during the migration: ${error.toString()}` });
	});
}, (error) => {
	// Log
	Logging.logError({
		source: "BootStrap", module: "start", method: "-", action: "StartDatabase",
		message: `Cannot start MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}': ${error.toString()}` });
	console.log(`Cannot start MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}': ${error.toString()}`);
});
