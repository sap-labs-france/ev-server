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

// Start
Bootstrap.start();

class Bootstrap {
	static async start() {
		try {
			// Connect to the the DB
			await global.storage.start();
		
			// Check and trigger migration
			await MigrationHandler.migrate();
		
			// Import Users
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
		
			// Get all configs
			let centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
			let centralSystemsConfig = Configuration.getCentralSystemsConfig();
			let chargingStationConfig = Configuration.getChargingStationConfig();
		
			// Start REST Server
			if (centralSystemRestConfig) {
				// Create the server
				let centralRestServer = new CentralRestServer(centralSystemRestConfig, chargingStationConfig);
				// Set to database for Web Socket Notifications
				global.storage.setCentralRestServer(centralRestServer);
				// Start it
				await centralRestServer.start();
			}
		
			// -------------------------------------------------------------------------
			// Instanciate central servers
			// -------------------------------------------------------------------------
			if (centralSystemsConfig) {
				// Start
				for (const centralSystemConfig of centralSystemsConfig) {
					let centralSystemServer;
					// Check implementation
					switch (centralSystemConfig.implementation) {
						// SOAP
						case 'soap':
							// Create implementation
							centralSystemServer = new SoapCentralSystemServer(centralSystemConfig, chargingStationConfig);
							// Start
							await centralSystemServer.start();
							break;
						// Not Found
						default:
							console.log(`Central System Server implementation '${centralSystemConfig.implementation}' not found!`);
					}
				};
			}
		
			// -------------------------------------------------------------------------
			// Init the Scheduler
			// -------------------------------------------------------------------------
			SchedulerManager.init();
		
		} catch (error) {
			// Log
			Logging.logError({
				source: "BootStrap", module: "start", method: "-", action: "StartServer",
				message: `Unexpected exception: ${error.toString()}` });
			console.log(`Unexpected exception: ${error.toString()}`);
		}
	}
}
