import cluster from 'cluster';
import SourceMap from 'source-map-support';
import CentralRestServer from './server/rest/CentralRestServer';
import Configuration from './utils/Configuration';
import Constants from './utils/Constants';
import global from './types/GlobalType';
import JsonCentralSystemServer from './server/ocpp/json/JsonCentralSystemServer';
import LockingStorage from './storage/mongodb/LockingStorage';
import Logging from './utils/Logging';
import MigrationHandler from './migration/MigrationHandler';
import MongoDBStorage from './storage/mongodb/MongoDBStorage';
import MongoDBStorageNotification from './storage/mongodb/MongoDBStorageNotification';
import OCPIServer from './server/ocpi/OCPIServer';
import ODataServer from './server/odata/ODataServer';
import SchedulerManager from './scheduler/SchedulerManager';
import SoapCentralSystemServer from './server/ocpp/soap/SoapCentralSystemServer';
import Utils from './utils/Utils';

SourceMap.install();

const MODULE_NAME = 'Bootstrap';
export default class Bootstrap {
  private static numWorkers: number;
  private static isClusterEnabled: boolean;
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
  private static databaseDone: boolean;
  private static database: any;
  private static migrationDone: boolean;

  public static async start(): Promise<void> {
    try {
      if (cluster.isMaster) {
        const nodejsEnv = process.env.NODE_ENV || 'development';
        // eslint-disable-next-line no-console
        console.log(`NodeJS is started in '${nodejsEnv}' mode`);
      }
      // Get all configs
      Bootstrap.storageConfig = Configuration.getStorageConfig();
      Bootstrap.centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
      Bootstrap.centralSystemsConfig = Configuration.getCentralSystemsConfig();
      Bootstrap.chargingStationConfig = Configuration.getChargingStationConfig();
      Bootstrap.ocpiConfig = Configuration.getOCPIServiceConfig();
      Bootstrap.oDataServerConfig = Configuration.getODataServiceConfig();
      Bootstrap.isClusterEnabled = Configuration.getClusterConfig().enabled;
      // Init global user and tenant IDs hashmap
      global.userHashMapIDs = {};
      global.tenantHashMapIDs = {};

      // Start the connection to the Database
      if (!Bootstrap.databaseDone) {
        // Check database implementation
        switch (Bootstrap.storageConfig.implementation) {
          // MongoDB?
          case 'mongodb':
            // Create MongoDB
            Bootstrap.database = new MongoDBStorage(Bootstrap.storageConfig);
            break;
          default:
            // eslint-disable-next-line no-console
            console.log(`Storage Server implementation '${Bootstrap.storageConfig.implementation}' not supported!`);
        }
        // Connect to the Database
        await Bootstrap.database.start();
        let logMsg;
        if (cluster.isMaster) {
          logMsg = `Database connected to '${Bootstrap.storageConfig.implementation}' successfully in master`;
        } else {
          logMsg = `Database connected to '${Bootstrap.storageConfig.implementation}' successfully in worker ${cluster.worker.id}`;
        }
        // Log
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          module: MODULE_NAME, method: 'start', action: 'Start',
          message: logMsg
        });
        Bootstrap.databaseDone = true;
      }
      global.database = Bootstrap.database;
      // Clean the locks in DB belonging to the current app/host
      if (cluster.isMaster && Bootstrap.databaseDone) {
        await LockingStorage.cleanLocks();
      }

      if (cluster.isMaster && !Bootstrap.migrationDone && Bootstrap.centralSystemRestConfig) {
        // Check and trigger migration (only master process can run the migration)
        await MigrationHandler.migrate();
        Bootstrap.migrationDone = true;
      }

      // Listen to promise failure
      process.on('unhandledRejection', (reason: any, p): void => {
        // eslint-disable-next-line no-console
        console.log('Unhandled Rejection at Promise: ', p, ' reason: ', reason);
        Logging.logError({
          tenantID: Constants.DEFAULT_TENANT,
          source: 'Bootstrap', module: MODULE_NAME, method: 'start', action: 'UnhandledRejection',
          message: `Reason: ${(reason ? reason.message : 'Not provided')}`,
          detailedMessages: (reason ? reason.stack : null)
        });
      });

      // FIXME: Attach the socketIO server to the master process for now.
      //        Load balancing between workers needs to make the client session sticky.
      if (Bootstrap.centralSystemRestConfig && Bootstrap.centralSystemRestConfig.socketIO && cluster.isMaster) {
        // -------------------------------------------------------------------------
        // REST Server (Front-End)
        // -------------------------------------------------------------------------
        // Create the server
        if (!Bootstrap.centralRestServer) {
          Bootstrap.centralRestServer = new CentralRestServer(Bootstrap.centralSystemRestConfig, Bootstrap.chargingStationConfig);
        }
        // Start Socket IO server
        await Bootstrap.centralRestServer.startSocketIO();
      }

      if (cluster.isMaster && Bootstrap.isClusterEnabled) {
        Bootstrap.startMaster();
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
        message: `Unexpected exception: ${error.toString()}`
      });
    }
  }

  private static startServerWorkers(serverName): void {
    Bootstrap.numWorkers = Configuration.getClusterConfig().numWorkers;
    function onlineCb(worker): void {
      // Log
      const logMsg = `${serverName} server worker ${worker.id} is online`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: 'startServerWorkers', action: 'Startup',
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
    }
    function exitCb(worker, code, signal?): void {
      // Log
      const logMsg = serverName + ' server worker ' + worker.id + ' died with code: ' + code + ', and signal: ' + signal +
        '.\n Starting new ' + serverName + ' server worker';
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: 'startServerWorkers', action: 'Startup',
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
      cluster.fork();
    }
    // Log
    // eslint-disable-next-line no-console
    console.log(`Starting ${serverName} server master process: setting up ${Bootstrap.numWorkers} workers...`);
    // Create cluster worker processes
    for (let i = 1; i <= Bootstrap.numWorkers; i++) {
      // Invoke cluster fork method to create a cluster worker
      cluster.fork();
      // Log
      const logMsg = `Starting ${serverName} server worker ${i} of ${Bootstrap.numWorkers}...`;
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: MODULE_NAME,
        method: 'startServerWorkers', action: 'Startup',
        message: logMsg
      });
      // eslint-disable-next-line no-console
      console.log(logMsg);
    }
    cluster.on('online', onlineCb);
    cluster.on('exit', exitCb);
  }

  private static startMaster(): void {
    try {
      if (Bootstrap.isClusterEnabled && Utils.isEmptyArray(cluster.workers)) {
        Bootstrap.startServerWorkers('Main');
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

  private static async startServersListening(): Promise<void> {
    try {
      // -------------------------------------------------------------------------
      // REST Server (Front-End)
      // -------------------------------------------------------------------------
      if (Bootstrap.centralSystemRestConfig) {
        // Create the server
        if (!Bootstrap.centralRestServer) {
          Bootstrap.centralRestServer = new CentralRestServer(Bootstrap.centralSystemRestConfig, Bootstrap.chargingStationConfig);
        }
        // Create database Web Socket notifications
        if (!Bootstrap.storageNotification) {
          Bootstrap.storageNotification = new MongoDBStorageNotification(Bootstrap.storageConfig, Bootstrap.centralRestServer);
        }
        // Start database Web Socket notifications
        Bootstrap.storageNotification.start();
        // Start it
        await Bootstrap.centralRestServer.start();
        // pragma if (this.centralSystemRestConfig.socketIO) {
        //   await this.centralRestServer.startSocketIO();
        // }
      }

      // -------------------------------------------------------------------------
      // Central Server (Charging Stations)
      // -------------------------------------------------------------------------
      if (Bootstrap.centralSystemsConfig) {
        // Start
        for (const centralSystemConfig of Bootstrap.centralSystemsConfig) {
          // Check implementation
          switch (centralSystemConfig.implementation) {
            // SOAP
            case 'soap':
              // Create implementation
              Bootstrap.SoapCentralSystemServer = new SoapCentralSystemServer(centralSystemConfig, Bootstrap.chargingStationConfig);
              // Start
              await Bootstrap.SoapCentralSystemServer.start();
              break;
            case 'json':
              // Create implementation
              Bootstrap.JsonCentralSystemServer = new JsonCentralSystemServer(centralSystemConfig, Bootstrap.chargingStationConfig);
              // Start
              await Bootstrap.JsonCentralSystemServer.start();
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
      if (Bootstrap.ocpiConfig) {
        // Create server instance
        Bootstrap.ocpiServer = new OCPIServer(Bootstrap.ocpiConfig);
        // Start server instance
        await Bootstrap.ocpiServer.start();
      }

      // -------------------------------------------------------------------------
      // OData Server
      // -------------------------------------------------------------------------
      if (Bootstrap.oDataServerConfig) {
        // Create server instance
        Bootstrap.oDataServer = new ODataServer(Bootstrap.oDataServerConfig);
        // Start server instance
        await Bootstrap.oDataServer.start();
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
}

// Start
Bootstrap.start();
