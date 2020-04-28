import cluster from 'cluster';
import MigrationHandler from './migration/MigrationHandler';
import SchedulerManager from './scheduler/SchedulerManager';
import OCPIServer from './server/ocpi/OCPIServer';
import JsonCentralSystemServer from './server/ocpp/json/JsonCentralSystemServer';
import SoapCentralSystemServer from './server/ocpp/soap/SoapCentralSystemServer';
import ODataServer from './server/odata/ODataServer';
import CentralRestServer from './server/rest/CentralRestServer';
import LockingStorage from './storage/mongodb/LockingStorage';
import MongoDBStorage from './storage/mongodb/MongoDBStorage';
import MongoDBStorageNotification from './storage/mongodb/MongoDBStorageNotification';
import CentralSystemConfiguration from './types/configuration/CentralSystemConfiguration';
import CentralSystemRestServiceConfiguration from './types/configuration/CentralSystemRestServiceConfiguration';
import ChargingStationConfiguration from './types/configuration/ChargingStationConfiguration';
import MigrationConfiguration from './types/configuration/MigrationConfiguration';
import OCPIServiceConfiguration from './types/configuration/OCPIServiceConfiguration';
import ODataServiceConfiguration from './types/configuration/ODataServiceConfiguration';
import StorageConfiguration from './types/configuration/StorageConfiguration';
import global from './types/GlobalType';
import Configuration from './utils/Configuration';
import Constants from './utils/Constants';
import I18nManager from './utils/I18nManager';
import Logging from './utils/Logging';
import Utils from './utils/Utils';
import { ServerAction } from './types/Server';

const MODULE_NAME = 'Bootstrap';
export default class Bootstrap {
  private static numWorkers: number;
  private static isClusterEnabled: boolean;
  private static centralSystemRestConfig: CentralSystemRestServiceConfiguration;
  private static centralRestServer: CentralRestServer;
  private static chargingStationConfig: ChargingStationConfiguration;
  private static storageNotification: any;
  private static storageConfig: StorageConfiguration;
  private static centralSystemsConfig: CentralSystemConfiguration[];
  private static SoapCentralSystemServer: SoapCentralSystemServer;
  private static JsonCentralSystemServer: JsonCentralSystemServer;
  private static ocpiConfig: OCPIServiceConfiguration;
  private static ocpiServer: OCPIServer;
  private static oDataServerConfig: ODataServiceConfiguration;
  private static oDataServer: ODataServer;
  private static databaseDone: boolean;
  private static database: any;
  private static migrationConfig: MigrationConfiguration;
  private static migrationDone: boolean;

  public static async start(): Promise<void> {
    try {
      // Setup i18n
      await I18nManager.initialize();
      // Master?
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
      Bootstrap.migrationConfig = Configuration.getMigrationConfig();
      // Init global user and tenant IDs hashmap
      global.userHashMapIDs = new Map<string, string>();
      global.tenantHashMapIDs = new Map<string, string>();
      // Start the connection to the Database
      if (!Bootstrap.databaseDone) {
        // Check database implementation
        switch (Bootstrap.storageConfig.implementation) {
          // MongoDB?
          case 'mongodb':
            // Create MongoDB
            Bootstrap.database = new MongoDBStorage(Bootstrap.storageConfig);
            // Keep a global reference
            global.database = Bootstrap.database;
            break;
          default:
            // eslint-disable-next-line no-console
            console.log(`Storage Server implementation '${Bootstrap.storageConfig.implementation}' not supported!`);
        }
        // Connect to the Database
        await Bootstrap.database.start();
        let logMsg: string;
        if (cluster.isMaster) {
          logMsg = `Database connected to '${Bootstrap.storageConfig.implementation}' successfully in master`;
        } else {
          logMsg = `Database connected to '${Bootstrap.storageConfig.implementation}' successfully in worker ${cluster.worker.id}`;
        }
        // Log
        Logging.logInfo({
          tenantID: Constants.DEFAULT_TENANT,
          action: ServerAction.STARTUP,
          module: MODULE_NAME, method: 'start',
          message: logMsg
        });
        Bootstrap.databaseDone = true;
      }
      if (cluster.isMaster && !Bootstrap.migrationDone && Bootstrap.migrationConfig.active) {
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
          action: ServerAction.STARTUP,
          module: MODULE_NAME, method: 'start',
          message: `Reason: ${(reason ? reason.message : 'Not provided')}`,
          detailedMessages: (reason ? reason.stack : null)
        });
      });
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
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'start',
        message: 'Unexpected exception',
        detailedMessages: { error: error.message, stack: error.stack }
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
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'startServerWorkers',
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
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'startServerWorkers',
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
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'startServerWorkers',
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
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'startMasters',
        message: `Unexpected exception ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}: ${error.toString()}`,
        detailedMessages: { error: error.message, stack: error.stack }
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
        // FIXME: Issue with cluster, see https://github.com/LucasBrazi06/ev-server/issues/1097
        if (this.centralSystemRestConfig.socketIO) {
          await this.centralRestServer.startSocketIO();
        }
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
              // FIXME: Issue with cluster, see https://github.com/LucasBrazi06/ev-server/issues/1097
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
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'startServersListening',
        message: `Unexpected exception ${cluster.isWorker ? 'in worker ' + cluster.worker.id : 'in master'}: ${error.toString()}`,
        detailedMessages: { error: error.message, stack: error.stack }
      });
    }
  }
}

// Start
Bootstrap.start().catch(
  (error) => {
    console.log(error);
  }
);
