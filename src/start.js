const path = require('path');
global.appRoot = path.resolve(__dirname);
global.Promise = require('bluebird');
const cluster = require('cluster');
const MongoDBStorage = require('./storage/mongodb/MongoDBStorage');
const MongoDBStorageNotification = require('./storage/mongodb/MongoDBStorageNotification');
const Configuration = require('./utils/Configuration');
const SoapCentralSystemServer = require('./server/ocpp/soap/SoapCentralSystemServer');
const JsonCentralSystemServer = require('./server/ocpp/json/JsonCentralSystemServer');
const CentralRestServer = require('./server/rest/CentralRestServer');
const OCPIServer = require('./server/ocpi/OCPIServer');
const ODataServer = require('./server/odata/ODataServer');
const SchedulerManager = require('./scheduler/SchedulerManager');
const MigrationHandler = require('./migration/MigrationHandler');
const Logging = require('./utils/Logging');
const Constants = require('./utils/Constants');
const Utils = require('./utils/Utils');

require('source-map-support').install();

const MODULE_NAME = 'Bootstrap';

class Bootstrap {
  static _startServerWorkers(serverName) {
    this._num_workers = Configuration.getClusterConfig().num_worker;
    function onlineCb(worker) {
      // Log
      const logMsg = `${serverName} server worker ${worker.id} is online`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "_startServerWorkers", action: "Startup",
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
    }
    function exitCb(worker, code, signal) {
      // Log
      const logMsg = serverName + ' server worker ' + worker.id + ' died with code: ' + code + ', and signal: ' + signal +
        '.\n Starting new ' + serverName + ' server worker';
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "_startServerWorkers", action: "Startup",
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      cluster.fork();
    }
    // Log
    // eslint-disable-next-line no-console
    console.log(`Starting ${serverName} server master process: setting up ${this._num_workers} workers...`);
    // Create cluster worker processes
    for (let i = 1; i <= this._num_workers; i++) {
      // Invoke cluster fork method to create a cluster worker
      cluster.fork();
      // Log
      const logMsg = `Starting ${serverName} server worker ${i} of ${this._num_workers}...`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "_startServerWorkers", action: "Startup",
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
    }
    cluster.on('online', onlineCb);
    cluster.on('exit', exitCb);
  }

  static async _startMaster() {
    try {
      if (this._isClusterEnable && Utils.isEmptyArray(cluster.workers)) {
        await Bootstrap._startServerWorkers("Main");
      }
    } catch (error) {
      // Log
      // eslint-disable-next-line no-console
      console.error(error);
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Bootstrap', module: MODULE_NAME, method: '_startMasters', action: 'Start',
        message: `Unexpected exception ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}: ${error.toString()}`
      });
    }
  }

  /**
   * Start the listening of all servers only
   *
   * @private
   */
  static async _startServersListening() {
    try {
      // -------------------------------------------------------------------------
      // REST Server (Front-End)
      // -------------------------------------------------------------------------
      if (this._centralSystemRestConfig) {
        // Create the server
        if (!this._centralRestServer)
          this._centralRestServer = new CentralRestServer(this._centralSystemRestConfig, this._chargingStationConfig);
        // Create database Web Socket notifications
        if (!this._storageNotification)
          this._storageNotification = new MongoDBStorageNotification(this._storageConfig, this._centralRestServer);
        // Start database Web Socket notifications
        this._storageNotification.start();
        // Start it
        await this._centralRestServer.start();
        // if (this._centralSystemRestConfig.socketIO) {
        //   await this._centralRestServer.startSocketIO();
        // }
      }

      // -------------------------------------------------------------------------
      // Central Server (Charging Stations)
      // -------------------------------------------------------------------------
      if (this._centralSystemsConfig) {
        // Start
        for (const centralSystemConfig of this._centralSystemsConfig) {
          // Check implementation
          switch (centralSystemConfig.implementation) {
            // SOAP
            case 'soap':
              // Create implementation
              this._SoapCentralSystemServer = new SoapCentralSystemServer(centralSystemConfig, this._chargingStationConfig);
              // Start
              await this._SoapCentralSystemServer.start();
              break;
            case 'json':
              // Create implementation
              this._JsonCentralSystemServer = new JsonCentralSystemServer(centralSystemConfig, this._chargingStationConfig);
              // Start
              await this._JsonCentralSystemServer.start();
              break;
            // Not Found
            default:
              // eslint-disable-next-line no-console
              console.log(`Central System Server implementation '${centralSystemConfig.implementation}' not found!`);
          }
        }
      }

      // -------------------------------------------------------------------------
      // OCPI Server
      // -------------------------------------------------------------------------
      if (this._ocpiConfig) {
        // Create server instance
        this._ocpiServer = new OCPIServer(this._ocpiConfig);
        // Start server instance
        await this._ocpiServer.start();
      }

      // -------------------------------------------------------------------------
      // OData Server
      // -------------------------------------------------------------------------
      if (this._oDataServerConfig) {
        // Create server instance
        this._oDataServer = new ODataServer(this._oDataServerConfig);
        // Start server instance
        await this._oDataServer.start();
      }
    } catch (error) {
      // Log
      // eslint-disable-next-line no-console
      console.error(error);
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Bootstrap', module: MODULE_NAME, method: '_startServersListening', action: 'Start',
        message: `Unexpected exception ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}: ${error.toString()}`
      });
    }
  }

  static async start() {
    try {
      if (cluster.isMaster) {
        const nodejs_env = process.env.NODE_ENV || 'dev';
        // eslint-disable-next-line no-console
        console.log(`NodeJS is started in '${nodejs_env}' mode`);
      }
      // Get all configs
      this._storageConfig = Configuration.getStorageConfig();
      this._centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
      this._centralSystemsConfig = Configuration.getCentralSystemsConfig();
      this._chargingStationConfig = Configuration.getChargingStationConfig();
      this._ocpiConfig = Configuration.getOCPIServiceConfig();
      this._oDataServerConfig = Configuration.getODataServiceConfig();
      this._isClusterEnable = Configuration.getClusterConfig().enable;
      // Init global vars
      global.userHashMapIDs = {};
      global.tenantHashMapIDs = {};

      // Start the connection to the Database
      if (!this._databaseDone) {
        // Check database implementation
        switch (this._storageConfig.implementation) {
          // MongoDB?
          case 'mongodb':
            // Create MongoDB
            this._database = new MongoDBStorage(this._storageConfig);
            break;
          default:
            // eslint-disable-next-line no-console
            console.log(`Storage Server implementation '${this._storageConfig.implementation}' not supported!`);
        }
        // Connect to the Database
        await this._database.start();
        let logMsg;
        if (cluster.isMaster) {
          logMsg = `Database connected to '${this._storageConfig.implementation}' successfully in master`;
        } else {
          logMsg = `Database connected to '${this._storageConfig.implementation}' successfully in worker ${cluster.worker.id}`;
        }
        // Log
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'start', action: 'Start',
          message: logMsg
        });
        this._databaseDone = true;
      }
      global.database = this._database;

      if (cluster.isMaster && !this._migrationDone && this._centralSystemRestConfig) {
        // Check and trigger migration (only master process can run the migration)
        await MigrationHandler.migrate();
        this._migrationDone = true;
      }

      // Listen to promise failure
      process.on('unhandledRejection', (reason, p) => {
        // eslint-disable-next-line no-console
        console.log("Unhandled Rejection at Promise: ", p, " reason: ", reason);
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: 'Bootstrap', module: MODULE_NAME, method: 'start', action: 'UnhandledRejection',
          message: `Reason: ${(reason ? reason.message : 'Not provided')}`,
          detailedMessages: (reason ? reason.stack : null)
        });
      });

      // FIXME: Attach the socketIO server to the master process for now.
      //        Load balancing between workers needs to make the client session sticky.
      if (this._centralSystemRestConfig && this._centralSystemRestConfig.socketIO && cluster.isMaster) {
        // -------------------------------------------------------------------------
        // REST Server (Front-End)
        // -------------------------------------------------------------------------
        // Create the server
        if (!this._centralRestServer) {
          this._centralRestServer = new CentralRestServer(this._centralSystemRestConfig, this._chargingStationConfig);
        }
        // Start Socket IO server
        await this._centralRestServer.startSocketIO();
      }

      if (cluster.isMaster && this._isClusterEnable) {
        await Bootstrap._startMaster();
      } else {
        await Bootstrap._startServersListening();
      }

      if (cluster.isMaster) {
        // -------------------------------------------------------------------------
        // Init the Scheduler
        // -------------------------------------------------------------------------
        SchedulerManager.init();
      }

    } catch (error) {
      // Log
      // eslint-disable-next-line no-console
      console.error(error);
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Bootstrap', module: MODULE_NAME, method: 'start', action: 'Start',
        message: `Unexpected exception ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}: ${error.toString()}`
      });
    }
  }
}

// Start
Bootstrap.start();