const MongoDBStorage = require('./storage/mongodb/MongoDBStorage');
const MongoDBStorageNotification = require('./storage/mongodb/MongoDBStorageNotification');
const Configuration = require('./utils/Configuration');
const SoapCentralSystemServer = require('./server/ocpp/soap/SoapCentralSystemServer');
const JsonCentralSystemServer = require('./server/ocpp/json/JsonCentralSystemServer');
const CentralRestServer = require('./server/rest/CentralRestServer');
const OCPIServer = require('./server/ocpi/OCPIServer');
const SchedulerManager = require('./scheduler/SchedulerManager');
const MigrationHandler = require('./migration/MigrationHandler');
const Logging = require('./utils/Logging');
const Constants = require('./utils/Constants');

require('source-map-support').install();

class Bootstrap {
  static async start() {
    try {
      // Start the connection to the Database
      const storageConfig = Configuration.getStorageConfig();

      const nodejs_env = process.env.NODE_ENV || 'dev';
      console.log(`NodeJS is started in '${nodejs_env}' mode`); // eslint-disable-line

      // Check implementation
      let database;
      switch (storageConfig.implementation) {
        // MongoDB?
        case 'mongodb':
          // Create MongoDB
          database = new MongoDBStorage(storageConfig);
          break;

        default:
          console.log(`Storage Server implementation '${storageConfig.implementation}' not supported!`); // eslint-disable-line
      }

      global.database = database;
      // Connect to the the DB
      await database.start();

      // Log
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'Bootstrap', method: 'start', action: 'Startup',
        message: `Database connected to '${storageConfig.implementation}' successfully`
      });

      // Get all configs
      const centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
      const centralSystemsConfig = Configuration.getCentralSystemsConfig();
      const chargingStationConfig = Configuration.getChargingStationConfig();
      const ocpiConfig = Configuration.getOCPIServiceConfig();

      // -------------------------------------------------------------------------
      // REST Server (Front-End)
      // -------------------------------------------------------------------------
      if (centralSystemRestConfig) {
        // Check and trigger migration (only Central REST Server can run the migration)
        await MigrationHandler.migrate();
        // Create the server
        const centralRestServer = new CentralRestServer(centralSystemRestConfig, chargingStationConfig);
        // Set to database for Web Socket Notifications

        const storageNotification = new MongoDBStorageNotification(storageConfig, centralRestServer);
        storageNotification.start();

        // Start it
        await centralRestServer.start();
      }

      // -------------------------------------------------------------------------
      // Central Server (Charging Stations)
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
            case 'json':
              // Create implementation
              centralSystemServer = new JsonCentralSystemServer(centralSystemConfig, chargingStationConfig);
              // Start
              await centralSystemServer.start();
              break;
            // Not Found
            default:
              console.log(`Central System Server implementation '${centralSystemConfig.implementation}' not found!`); // eslint-disable-line
          }
        }
        
      }

      // -------------------------------------------------------------------------
      // OCPI Server
      // -------------------------------------------------------------------------
      if (ocpiConfig) {
        // create server instance
        const ocpiServer = new OCPIServer(ocpiConfig);

        await ocpiServer.start();
      }

      // -------------------------------------------------------------------------
      // Init the Scheduler
      // -------------------------------------------------------------------------
      SchedulerManager.init();

    } catch (error) {
      // Log
      console.error(error); // eslint-disable-line
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'BootStrap', module: 'start', method: '-', action: 'StartServer',
        message: `Unexpected exception: ${error.toString()}`
      });
    }
  }
}

// Start
Bootstrap.start();
