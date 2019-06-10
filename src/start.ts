import path from 'path';
global.appRoot = path.resolve(__dirname);
import TSGlobal from './types/GlobalType';
import BBPromise from 'bluebird';
global.Promise = BBPromise;
import cluster from 'cluster';
import MongoDBStorage from './storage/mongodb/MongoDBStorage';
import MongoDBStorageNotification from './storage/mongodb/MongoDBStorageNotification';
import Configuration from './utils/Configuration';
import SoapCentralSystemServer from './server/ocpp/soap/SoapCentralSystemServer';
import JsonCentralSystemServer from './server/ocpp/json/JsonCentralSystemServer';
import CentralRestServer from './server/rest/CentralRestServer';
import OCPIServer from './server/ocpi/OCPIServer';
import ODataServer from './server/odata/ODataServer';
import SchedulerManager from './scheduler/SchedulerManager';
import MigrationHandler from './migration/MigrationHandler';
import Logging from './utils/Logging';
import Constants from './utils/Constants';
import Utils from './utils/Utils';
import SourceMap from 'source-map-support';
SourceMap.install();

declare var global: TSGlobal;
const MODULE_NAME = 'Bootstrap';

export default class Bootstrap {
  private static num_workers: any;
  private static isClusterEnable: any;
  private static centralSystemRestConfig: any;
  private static centralRestServer: any;
  private static chargingStationConfig: any;
  private static storageNotification: any;
  private static storageConfig: any;
  private static centralSystemsConfig: any;
  private static SoapCentralSystemServer: any;
  private static JsonCentralSystemServer: any;
  private static ocpiConfig: any;
  private static ocpiServer: any;
  private static oDataServerConfig: any;
  private static oDataServer: any;
  private static databaseDone: any;
  private static database: any;
  private static migrationDone: any;

  private static startServerWorkers(serverName) {
    this.num_workers = Configuration.getClusterConfig().num_worker;
    function onlineCb(worker) {
      // Log
      const logMsg = `${serverName} server worker ${worker.id} is online`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "startServerWorkers", action: "Startup",
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
    }
    function exitCb(worker, code, signal?) {
      // Log
      const logMsg = serverName + ' server worker ' + worker.id + ' died with code: ' + code + ', and signal: ' + signal +
        '.\n Starting new ' + serverName + ' server worker';
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "startServerWorkers", action: "Startup",
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      cluster.fork();
    }
    // Log
    // eslint-disable-next-line no-console
    console.log(`Starting ${serverName} server master process: setting up ${this.num_workers} workers...`);
    // Create cluster worker processes
    for (let i = 1; i <= this.num_workers; i++) {
      // Invoke cluster fork method to create a cluster worker
      cluster.fork();
      // Log
      const logMsg = `Starting ${serverName} server worker ${i} of ${this.num_workers}...`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: "startServerWorkers", action: "Startup",
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
    }
    cluster.on('online', onlineCb);
    cluster.on('exit', exitCb);
  }

  static async startMaster() {
    try {
      if (this.isClusterEnable && Utils.isEmptyArray(cluster.workers)) {
        await Bootstrap.startServerWorkers("Main");
      }
    } catch (error) {
      // Log
      // eslint-disable-next-line no-console
      console.error(error);
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Bootstrap', module: MODULE_NAME, method: 'startMasters', action: 'Start',
        message: `Unexpected exception ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}: ${error.toString()}`
      });
    }
  }

  static async startServersListening() {
    try {
      // -------------------------------------------------------------------------
      // REST Server (Front-End)
      // -------------------------------------------------------------------------
      if (this.centralSystemRestConfig) {
        // Create the server
        if (!this.centralRestServer)
          this.centralRestServer = new CentralRestServer(this.centralSystemRestConfig, this.chargingStationConfig);
        // Create database Web Socket notifications
        if (!this.storageNotification)
          this.storageNotification = new MongoDBStorageNotification(this.storageConfig, this.centralRestServer);
        // Start database Web Socket notifications
        this.storageNotification.start();
        // Start it
        await this.centralRestServer.start();
        // if (this.centralSystemRestConfig.socketIO) {
        //   await this.centralRestServer.startSocketIO();
        // }
      }

      // -------------------------------------------------------------------------
      // Central Server (Charging Stations)
      // -------------------------------------------------------------------------
      if (this.centralSystemsConfig) {
        // Start
        for (const centralSystemConfig of this.centralSystemsConfig) {
          // Check implementation
          switch (centralSystemConfig.implementation) {
            // SOAP
            case 'soap':
              // Create implementation
              this.SoapCentralSystemServer = new SoapCentralSystemServer(centralSystemConfig, this.chargingStationConfig);
              // Start
              await this.SoapCentralSystemServer.start();
              break;
            case 'json':
              // Create implementation
              this.JsonCentralSystemServer = new JsonCentralSystemServer(centralSystemConfig, this.chargingStationConfig);
              // Start
              await this.JsonCentralSystemServer.start();
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
      if (this.ocpiConfig) {
        // Create server instance
        this.ocpiServer = new OCPIServer(this.ocpiConfig);
        // Start server instance
        await this.ocpiServer.start();
      }

      // -------------------------------------------------------------------------
      // OData Server
      // -------------------------------------------------------------------------
      if (this.oDataServerConfig) {
        // Create server instance
        this.oDataServer = new ODataServer(this.oDataServerConfig);
        // Start server instance
        await this.oDataServer.start();
      }
    } catch (error) {
      // Log
      // eslint-disable-next-line no-console
      console.error(error);
      Logging.logError({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'Bootstrap', module: MODULE_NAME, method: 'startServersListening', action: 'Start',
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
      this.storageConfig = Configuration.getStorageConfig();
      this.centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
      this.centralSystemsConfig = Configuration.getCentralSystemsConfig();
      this.chargingStationConfig = Configuration.getChargingStationConfig();
      this.ocpiConfig = Configuration.getOCPIServiceConfig();
      this.oDataServerConfig = Configuration.getODataServiceConfig();
      this.isClusterEnable = Configuration.getClusterConfig().enable;
      // Init global vars
      global.userHashMapIDs = {};
      global.tenantHashMapIDs = {};

      // Start the connection to the Database
      if (!this.databaseDone) {
        // Check database implementation
        switch (this.storageConfig.implementation) {
          // MongoDB?
          case 'mongodb':
            // Create MongoDB
            this.database = new MongoDBStorage(this.storageConfig);
            break;
          default:
            // eslint-disable-next-line no-console
            console.log(`Storage Server implementation '${this.storageConfig.implementation}' not supported!`);
        }
        // Connect to the Database
        await this.database.start();
        let logMsg;
        if (cluster.isMaster) {
          logMsg = `Database connected to '${this.storageConfig.implementation}' successfully in master`;
        } else {
          logMsg = `Database connected to '${this.storageConfig.implementation}' successfully in worker ${cluster.worker.id}`;
        }
        // Log
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'start', action: 'Start',
          message: logMsg
        });
        this.databaseDone = true;
      }
      global.database = this.database;

      if (cluster.isMaster && !this.migrationDone && this.centralSystemRestConfig) {
        // Check and trigger migration (only master process can run the migration)
        await MigrationHandler.migrate();
        this.migrationDone = true;
      }

      // Listen to promise failure
      process.on('unhandledRejection', (reason: any, p) => {
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
      if (this.centralSystemRestConfig && this.centralSystemRestConfig.socketIO && cluster.isMaster) {
        // -------------------------------------------------------------------------
        // REST Server (Front-End)
        // -------------------------------------------------------------------------
        // Create the server
        if (!this.centralRestServer) {
          this.centralRestServer = new CentralRestServer(this.centralSystemRestConfig, this.chargingStationConfig);
        }
        // Start Socket IO server
        await this.centralRestServer.startSocketIO();
      }

      if (cluster.isMaster && this.isClusterEnable) {
        await Bootstrap.startMaster();
      } else {
        await Bootstrap.startServersListening();
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
