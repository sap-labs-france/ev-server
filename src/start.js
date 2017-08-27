const MongoDBStorage = require('./storage/mongodb/MongoDBStorage');
const Configuration = require('./utils/Configuration');
const Utils = require('./utils/Utils');
const SoapCentralSystemServer = require('./server/charging-station/soap/SoapCentralSystemServer');
const CentralRestServer = require('./server/front-end/CentralRestServer');
const SchedulerHandler = require('./scheduler/SchedulerHandler');
const MigrationHandler = require('./migration/MigrationHandler');
const Logging = require('./utils/Logging');

require('source-map-support').install();

// Start the connection to the Database
let storageConfig = Configuration.getStorageConfig();

// Check implementation
switch (storageConfig.implementation) {
  // MongoDB?
  case 'mongodb':
    // Create MongoDB
    var mongoDB = new MongoDBStorage(storageConfig);
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
  // ---------------------------------------------------------------------------
  // Check and trigger migration
  // ---------------------------------------------------------------------------
  MigrationHandler.migrate().then((results) => {
    // ---------------------------------------------------------------------------
    // Import Users
    // ---------------------------------------------------------------------------
    try {
      // Import users
      Utils.importUsers();
    } catch (err) {
      // Log
      Logging.logError({
        userFullName: "System", source: "Central Server", module: "ImportUsersTask",
        method: "run", message: `Cannot import users: ${err.toString()}`,
        detailedMessages: err.stack });
    }

    // -------------------------------------------------------------------------
    // Create the Central Systems (Charging Stations)
    // -------------------------------------------------------------------------
    let centralSystemsConfig = Configuration.getCentralSystemsConfig();
    let chargingStationConfig = Configuration.getChargingStationConfig();
    let advancedConfig = Configuration.getAdvancedConfig();

    // -------------------------------------------------------------------------
    // Start the Central Rest System (Front-end REST service)
    // -------------------------------------------------------------------------
    let centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
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
    SchedulerHandler.init();
  }).catch((error) => {
    // Log
    Logging.logError({
      userFullName: "System", source: "BootStrap", module: "start", method: "-", action: "Migrate",
      message: `Error occurred during the migration: ${error.toString()}` });
  });
}, (error) => {
  // Log
  Logging.logError({
    userFullName: "System", source: "BootStrap", module: "start", method: "-", action: "StartDatabase",
    message: `Cannot start MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}': ${error.toString()}` });
  console.log(`Cannot start MongoDB (Database) on '${_dbConfig.host}:${_dbConfig.port}': ${error.toString()}`);
});
