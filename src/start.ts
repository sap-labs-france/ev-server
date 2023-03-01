import CentralSystemConfiguration, { CentralSystemImplementation } from './types/configuration/CentralSystemConfiguration';
import { ServerAction, ServerType } from './types/Server';

import AsyncTaskConfiguration from './types/configuration/AsyncTaskConfiguration';
import AsyncTaskManager from './async-task/AsyncTaskManager';
import { Cache } from './cache/Cache';
import CacheConfiguration from './types/configuration/CacheConfiguration';
import CentralSystemRestServiceConfiguration from './types/configuration/CentralSystemRestServiceConfiguration';
import ChargingStationConfiguration from './types/configuration/ChargingStationConfiguration';
import Configuration from './utils/Configuration';
import Constants from './utils/Constants';
import I18nManager from './utils/I18nManager';
import JsonOCPPServer from './server/ocpp/json/JsonOCPPServer';
import LocalCarCatalogBootstrap from './bootstrap/LocalCarCatalogBootstrap';
import Logging from './utils/Logging';
import MigrationConfiguration from './types/configuration/MigrationConfiguration';
import MigrationHandler from './migration/MigrationHandler';
import MongoDBStorage from './storage/mongodb/MongoDBStorage';
import MonitoringConfiguration from './types/configuration/MonitoringConfiguration';
import MonitoringServer from './monitoring/MonitoringServer';
import MonitoringServerFactory from './monitoring/MonitoringServerFactory';
import OCPIServer from './server/ocpi/OCPIServer';
import OCPIServiceConfiguration from './types/configuration/OCPIServiceConfiguration';
import ODataServer from './server/odata/ODataServer';
import ODataServiceConfiguration from './types/configuration/ODataServiceConfiguration';
import OICPServer from './server/oicp/OICPServer';
import OICPServiceConfiguration from './types/configuration/OICPServiceConfiguration';
import RestServer from './server/rest/RestServer';
import SchedulerConfiguration from './types/configuration/SchedulerConfiguration';
import SchedulerManager from './scheduler/SchedulerManager';
import SoapOCPPServer from './server/ocpp/soap/SoapOCPPServer';
import StorageConfiguration from './types/configuration/StorageConfiguration';
import TenantStorage from './storage/mongodb/TenantStorage';
import Utils from './utils/Utils';
import global from './types/GlobalType';

const MODULE_NAME = 'Bootstrap';

export default class Bootstrap {
  private static database: MongoDBStorage;

  private static centralRestServer: RestServer;
  private static storageConfig: StorageConfiguration;
  private static SoapCentralSystemServer: SoapOCPPServer;
  private static JsonCentralSystemServer: JsonOCPPServer;
  private static ocpiServer: OCPIServer;
  private static oicpServer: OICPServer;
  private static oDataServer: ODataServer;
  private static monitoringServer: MonitoringServer;

  private static centralSystemRestConfig: CentralSystemRestServiceConfiguration;
  private static chargingStationConfig: ChargingStationConfiguration;
  private static centralSystemsConfig: CentralSystemConfiguration[];
  private static ocpiConfig: OCPIServiceConfiguration;
  private static oicpConfig: OICPServiceConfiguration;
  private static oDataServerConfig: ODataServiceConfiguration;
  private static migrationConfig: MigrationConfiguration;
  private static asyncTaskConfig: AsyncTaskConfiguration;
  private static schedulerConfig: SchedulerConfiguration;
  private static monitoringConfig: MonitoringConfiguration;
  private static cacheConfig: CacheConfiguration;

  public static async start(): Promise<void> {
    let serverStarted: ServerType[] = [];
    let startTimeMillis: number;
    const startTimeGlobalMillis = await this.logAndGetStartTimeMillis('e-Mobility Server is starting...');

    try {
      // Setup i18n
      I18nManager.initialize();
      Logging.logConsoleDebug(`NodeJS is started in '${process.env.NODE_ENV || 'development'}' mode`);
      // Get all configs
      Bootstrap.storageConfig = Configuration.getStorageConfig();
      Bootstrap.centralSystemRestConfig = Configuration.getCentralSystemRestServiceConfig();
      Bootstrap.centralSystemsConfig = Configuration.getCentralSystemsConfig();
      Bootstrap.chargingStationConfig = Configuration.getChargingStationConfig();
      Bootstrap.ocpiConfig = Configuration.getOCPIServiceConfig();
      Bootstrap.oicpConfig = Configuration.getOICPServiceConfig();
      Bootstrap.oDataServerConfig = Configuration.getODataServiceConfig();
      Bootstrap.migrationConfig = Configuration.getMigrationConfig();
      Bootstrap.asyncTaskConfig = Configuration.getAsyncTaskConfig();
      Bootstrap.schedulerConfig = Configuration.getSchedulerConfig();
      Bootstrap.monitoringConfig = Configuration.getMonitoringConfig();
      Bootstrap.cacheConfig = Configuration.getCacheConfig();

      // -------------------------------------------------------------------------
      // Listen to promise failure
      // -------------------------------------------------------------------------
      process.on('unhandledRejection', (reason: any, p: any): void => {
        // eslint-disable-next-line no-console
        Logging.logConsoleError(`Unhandled Rejection: ${p?.toString()}, reason: ${reason as string}`);
        void Logging.logError({
          tenantID: Constants.DEFAULT_TENANT_ID,
          action: ServerAction.UNKNOWN_ACTION,
          module: MODULE_NAME, method: 'start',
          message: `Unhandled Rejection: ${(reason ? (reason.message ?? reason) : 'Not provided')}`,
          detailedMessages: (reason ? reason.stack : null)
        });
      });

      // -------------------------------------------------------------------------
      // Start Monitoring Server
      // -------------------------------------------------------------------------
      if (Bootstrap.monitoringConfig) {
        // Create server instance
        Bootstrap.monitoringServer = MonitoringServerFactory.getMonitoringServerImpl(Bootstrap.monitoringConfig);
        // Start server instance
        if (Bootstrap.monitoringServer) {
          Bootstrap.monitoringServer.start();
        } else {
          const message = `Monitoring Server implementation does not exist '${this.monitoringConfig.implementation}'`;
          Logging.logConsoleError(message);
          await Logging.logError({
            tenantID: Constants.DEFAULT_TENANT_ID,
            action: ServerAction.STARTUP,
            module: MODULE_NAME, method: 'startServers', message
          });
        }
      }

      // -------------------------------------------------------------------------
      // Create in memory cache
      // -------------------------------------------------------------------------
      if (Bootstrap.cacheConfig) {
        startTimeMillis = await this.logAndGetStartTimeMillis(`Creating memory cache with default TTL '${Bootstrap.cacheConfig.ttlSeconds}' seconds.`);
        global.cache = new Cache(Bootstrap.cacheConfig);
        await this.logDuration(startTimeMillis, 'Memory cache created successfully');
      }

      // -------------------------------------------------------------------------
      // Connect to the DB
      // -------------------------------------------------------------------------
      // Check database implementation
      startTimeMillis = await this.logAndGetStartTimeMillis('Connecting to the Database...');
      switch (Bootstrap.storageConfig.implementation) {
        // MongoDB?
        case 'mongodb':
          // Create MongoDB
          Bootstrap.database = new MongoDBStorage(Bootstrap.storageConfig);
          break;
        default:
          Logging.logConsoleError(`Storage Server implementation '${Bootstrap.storageConfig.implementation}' not supported!`);
      }
      // Connect to the Database
      await Bootstrap.database.start();
      await this.logDuration(startTimeMillis, 'Connected to the Database successfully');

      // -------------------------------------------------------------------------
      // Tenant cache for subdomains only
      // -------------------------------------------------------------------------
      global.tenantIdMap = new Map();
      await Bootstrap.fillTenantMap();
      setInterval(() => {
        Bootstrap.fillTenantMap().catch((error) => {
          Logging.logPromiseError(error);
        });
      }, 10 * 60 * 1000); // 10 min

      // -------------------------------------------------------------------------
      // Start DB Migration
      // -------------------------------------------------------------------------
      if (Bootstrap.migrationConfig?.active) {
        startTimeMillis = await this.logAndGetStartTimeMillis('Migration is starting...');
        // Check and trigger migration (only master process can run the migration)
        await MigrationHandler.migrate();
        await this.logDuration(startTimeMillis, 'Migration has been run successfully');
      }

      // -------------------------------------------------------------------------
      // Start all the Servers
      // -------------------------------------------------------------------------
      serverStarted = await Bootstrap.startServers();

      // -------------------------------------------------------------------------
      // Init the Scheduler
      // -------------------------------------------------------------------------
      if (Bootstrap.schedulerConfig?.active) {
        startTimeMillis = await this.logAndGetStartTimeMillis('Scheduler is starting...');
        // Start the Scheduler
        await SchedulerManager.init(Bootstrap.schedulerConfig);
        await this.logDuration(startTimeMillis, 'Scheduler has been started successfully');
      }

      // -------------------------------------------------------------------------
      // Init the Async Task
      // -------------------------------------------------------------------------
      if (Bootstrap.asyncTaskConfig?.active) {
        startTimeMillis = await this.logAndGetStartTimeMillis('Async Task manager is starting...');
        // Start the Async Manager
        await AsyncTaskManager.init(Bootstrap.asyncTaskConfig);
        await this.logDuration(startTimeMillis, 'Async Task manager has been started successfully');
      }

      // Update of manually uploaded data
      if (Bootstrap.migrationConfig?.active) {
        // -------------------------------------------------------------------------
        // Import Local Car Catalogs
        // -------------------------------------------------------------------------
        startTimeMillis = await this.logAndGetStartTimeMillis('Local car catalogs are being imported...');
        // Load and Save the Charging Station templates
        await LocalCarCatalogBootstrap.uploadLocalCarCatalogsFromFile();
        await this.logDuration(startTimeMillis, 'Local car catalogs has been imported successfully');
      }

      // Keep the server names globally
      if (serverStarted.length === 1) {
        global.serverType = serverStarted[0];
      } else {
        global.serverType = ServerType.CENTRAL_SERVER;
      }
      await this.logDuration(startTimeGlobalMillis, `${serverStarted.join(', ')} server has been started successfully`, ServerAction.BOOTSTRAP_STARTUP);
    } catch (error) {
      Logging.logConsoleError(error);
      global.database && await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.BOOTSTRAP_STARTUP,
        module: MODULE_NAME, method: 'start',
        message: `Unexpected exception in ${serverStarted.join(', ')}`,
        detailedMessages: { error: error.stack }
      });
    }
  }

  private static async logAndGetStartTimeMillis(logMessage: string): Promise<number> {
    const timeStartMillis = Date.now();
    Logging.logConsoleDebug(logMessage);
    if (global.database) {
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'start',
        message: logMessage
      });
    }
    return timeStartMillis;
  }

  private static async logDuration(timeStartMillis: number, logMessage: string, action: ServerAction = ServerAction.STARTUP): Promise<void> {
    const timeDurationSecs = Utils.createDecimal(Date.now() - timeStartMillis).div(1000).toNumber();
    logMessage = `${logMessage} in ${timeDurationSecs} secs`;
    Logging.logConsoleDebug(logMessage);
    if (global.database) {
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action,
        module: MODULE_NAME, method: 'start',
        message: logMessage
      });
    }
  }

  private static async startServers(): Promise<ServerType[]> {
    const serverTypes: ServerType[] = [];
    try {
      // -------------------------------------------------------------------------
      // REST Server (Front-End)
      // -------------------------------------------------------------------------
      if (Bootstrap.centralSystemRestConfig) {
        // Create the server
        if (!Bootstrap.centralRestServer) {
          Bootstrap.centralRestServer = new RestServer(Bootstrap.centralSystemRestConfig);
        }
        // Start it
        Bootstrap.centralRestServer.start();
        serverTypes.push(ServerType.REST_SERVER);
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
            case CentralSystemImplementation.SOAP:
              // Create implementation
              Bootstrap.SoapCentralSystemServer = new SoapOCPPServer(centralSystemConfig, Bootstrap.chargingStationConfig);
              // Start
              Bootstrap.SoapCentralSystemServer.start();
              serverTypes.push(ServerType.SOAP_SERVER);
              break;
            case CentralSystemImplementation.JSON:
              // Create implementation
              Bootstrap.JsonCentralSystemServer = new JsonOCPPServer(centralSystemConfig, Bootstrap.chargingStationConfig);
              // Start
              Bootstrap.JsonCentralSystemServer.start();
              serverTypes.push(ServerType.JSON_SERVER);
              break;
            // Not Found
            default:
              // eslint-disable-next-line no-console
              Logging.logConsoleError(`Central System Server implementation '${centralSystemConfig.implementation as string}' not found!`);
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
        Bootstrap.ocpiServer.start();
        serverTypes.push(ServerType.OCPI_SERVER);
      }
      // -------------------------------------------------------------------------
      // OICP Server
      // -------------------------------------------------------------------------
      if (Bootstrap.oicpConfig) {
        // Create server instance
        Bootstrap.oicpServer = new OICPServer(Bootstrap.oicpConfig);
        // Start server instance
        Bootstrap.oicpServer.start();
        serverTypes.push(ServerType.OICP_SERVER);
      }
      // -------------------------------------------------------------------------
      // OData Server
      // -------------------------------------------------------------------------
      if (Bootstrap.oDataServerConfig) {
        // Create server instance
        Bootstrap.oDataServer = new ODataServer(Bootstrap.oDataServerConfig);
        // Start server instance
        Bootstrap.oDataServer.start();
        serverTypes.push(ServerType.ODATA_SERVER);
      }
    } catch (error) {
      Logging.logConsoleError(error.stack);
      await Logging.logError({
        tenantID: Constants.DEFAULT_TENANT_ID,
        action: ServerAction.STARTUP,
        module: MODULE_NAME, method: 'startServers',
        message: `Unexpected exception in ${serverTypes.join(', ')}: ${error?.message as string}`,
        detailedMessages: { error: error?.stack }
      });
    }
    // Batch server only
    if (Utils.isEmptyArray(serverTypes)) {
      serverTypes.push(ServerType.BATCH_SERVER);
    }
    return serverTypes;
  }

  private static async fillTenantMap() : Promise<void> {
    const tenants = await TenantStorage.getTenants({}, Constants.DB_PARAMS_MAX_LIMIT);
    // eslint-disable-next-line no-empty
    for (const tenant of tenants.result) {
      global.tenantIdMap.set(tenant.id, tenant.subdomain);
    }
  }
}

// Start
Bootstrap.start().catch(
  (error) => {
    Logging.logConsoleError(error.stack);
  }
);
