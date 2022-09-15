import CentralSystemConfiguration, { CentralSystemImplementation } from './types/configuration/CentralSystemConfiguration';
import { ChargingStationTemplate, ConnectorType, CurrentType } from './types/ChargingStation';
import { ServerAction, ServerType } from './types/Server';

import AsyncTaskConfiguration from './types/configuration/AsyncTaskConfiguration';
import AsyncTaskManager from './async-task/AsyncTaskManager';
import CentralSystemRestServiceConfiguration from './types/configuration/CentralSystemRestServiceConfiguration';
import { ChargingRateUnitType } from './types/ChargingProfile';
import ChargingStationConfiguration from './types/configuration/ChargingStationConfiguration';
import ChargingStationTemplateStorage from './storage/mongodb/ChargingStationTemplateStorage';
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
      // Start DB Migration
      // -------------------------------------------------------------------------
      if (Bootstrap.migrationConfig?.active) {
        startTimeMillis = await this.logAndGetStartTimeMillis('Migration is starting...');
        // Check and trigger migration (only master process can run the migration)
        await MigrationHandler.migrate();
        await this.logDuration(startTimeMillis, 'Migration has been run successfully');
      }

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
        // Update Charging Station Templates
        // -------------------------------------------------------------------------
        startTimeMillis = await this.logAndGetStartTimeMillis('Charging Station templates is being updated...');
        // Load and Save the Charging Station templates
        await this.populateTemplates();
        await this.logDuration(startTimeMillis, 'Charging Station templates have been updated successfully');
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
      await this.logDuration(startTimeGlobalMillis, `${serverStarted.join(', ')} server has been started successfuly`, ServerAction.BOOTSTRAP_STARTUP);
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

  private static async populateTemplates(): Promise<void> {
    let created = 0;
    // Check if there is existing templates
    const existingTemplates = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates').findOne({});
    if (existingTemplates) {
      return;
    }
    try {
      let chargingStationTemplates: ChargingStationTemplate[] = [
        // Template Schneider~EV2S22P44|EVC1S22P4E4E
        {
          id: null,
          template: {
            chargePointVendor: "Schneider Electric",
          extraFilters: {
            chargePointModel: "MONOBLOCK|City \\(On Street\\)",
            chargeBoxSerialNumber: "EV\\.2S22P44|EVC1S22P4E4E"
          },
          technical: {
            maximumPower: 44160,
            voltage: 230,
            powerLimitUnit: ChargingRateUnitType.AMPERE,
            chargePoints: [
              {
                chargePointID: 1,
                currentType: CurrentType.AC,
                amperage: 192,
                numberOfConnectedPhase: 3,
                cannotChargeInParallel: false,
                sharePowerToAllConnectors: false,
                excludeFromPowerLimitation: false,
                ocppParamForPowerLimitation: "maxintensitysocket",
                power: 44160,
                voltage: null,
                efficiency: null,
                connectorIDs: [
                  1,
                  2
                ]
              }
            ],
            connectors: [
              {
                connectorId: 1,
                type: ConnectorType.TYPE_2,
                power: 22080,
                amperage: 96,
                chargePointID: 1
              },
              {
                connectorId: 2,
                type: ConnectorType.TYPE_2,
                power: 22080,
                amperage: 96,
                chargePointID: 1
              }
            ]
          },
          capabilities: [
            {
              supportedFirmwareVersions: [
                "3\\.[2-4]\\.0\\..*"
              ],
              supportedOcppVersions: [
                "1.6"
              ],
              capabilities: {
                supportStaticLimitation: true,
                supportChargingProfiles: true,
                supportRemoteStartStopTransaction: true,
                supportUnlockConnector: true,
                supportReservation: false,
                supportCreditCard: false,
                supportRFIDCard: false
              }
            }
          ],
          ocppStandardParameters: [
            {
              supportedFirmwareVersions: [
                "3\\.[2-4]\\.0\\..*"
              ],
              supportedOcppVersions: [
                "1.6"
              ],
              parameters: {
                "AllowOfflineTxForUnknownId": "true",
                "AuthorizationCacheEnabled": "false",
                "StopTransactionOnInvalidId": "true"
              }
            }
          ],
          ocppVendorParameters: [
            {
              supportedFirmwareVersions: [
                "3\\.2\\.0\\..*"
              ],
              supportedOcppVersions: [
                "1.6"
              ],
              parameters: {
                "authenticationmanager": "2",
                "ocppconnecttimeout": "60",
                "clockaligneddatainterval": "0",
                "metervaluessampleddata": "Energy.Active.Import.Register,Current.Import,Current.Import.L1,Current.Import.L2,Current.Import.L3,Voltage,Voltage.L1,Voltage.L2,Voltage.L3",
                "metervaluesampleinterval": "60",
                "emsetting": "3",
                "enableevdetection": "true",
                "useautotimemanagment": "true",
                "timeservername": "pool.ntp.org",
                "monophasedloadsheddingfloorvalue": "6",
                "triphasedloadsheddingfloorvalue": "6"
              }
            },
            {
              supportedFirmwareVersions: [
                "3\\.[3-4]\\.0\\..*"
              ],
              supportedOcppVersions: [
                "1.6"
              ],
              parameters: {
                "authenticationmanager": "2",
                "ocppconnecttimeout": "60",
                "clockaligneddatainterval": "0",
                "metervaluessampleddata": "Energy.Active.Import.Register,Current.Import,Current.Import.L1,Current.Import.L2,Current.Import.L3,Voltage,Voltage.L1,Voltage.L2,Voltage.L3",
                "metervaluesampleinterval": "60",
                "emsetting": "3",
                "enableevdetection": "true",
                "useautotimemanagment": "true",
                "timeservername": "pool.ntp.org",
                "websocketpinginterval": "30",
                "monophasedloadsheddingfloorvalue": "6",
                "triphasedloadsheddingfloorvalue": "6"
              }
            }
          ]
          }
        },
        // Template Schneider~EV2S7P44|EVC1S7P4E4E
        {
          id: null,
          template: {
            chargePointVendor: "Schneider Electric",
            extraFilters: {
              chargePointModel: "MONOBLOCK|City \\(On Street\\)",
              chargeBoxSerialNumber: "EV\\.2S7P44|EVC1S7P4E4E"
            },
            technical: {
              maximumPower: 14720,
              voltage: 230,
              powerLimitUnit: ChargingRateUnitType.AMPERE,
              chargePoints: [
                {
                  chargePointID: 1,
                  currentType: CurrentType.AC,
                  amperage: 64,
                  numberOfConnectedPhase: 1,
                  cannotChargeInParallel: false,
                  sharePowerToAllConnectors: false,
                  excludeFromPowerLimitation: false,
                  ocppParamForPowerLimitation: "maxintensitysocket",
                  power: 14720,
                  voltage: null,
                  efficiency: null,
                  connectorIDs: [
                    1,
                    2
                  ]
                }
              ],
              connectors: [
                {
                  connectorId: 1,
                  type: ConnectorType.TYPE_2,
                  power: 7360,
                  amperage: 32,
                  chargePointID: 1
                },
                {
                  connectorId: 2,
                  type: ConnectorType.TYPE_2,
                  power: 7360,
                  amperage: 32,
                  chargePointID: 1
                }
              ]
            },
            capabilities: [
              {
                supportedFirmwareVersions: [
                  "3\\.[2-4]\\.0\\..*"
                ],
                supportedOcppVersions: [
                  "1.6"
                ],
                capabilities: {
                  supportStaticLimitation: true,
                  supportChargingProfiles: true,
                  supportRemoteStartStopTransaction: true,
                  supportUnlockConnector: true,
                  supportReservation: false,
                  supportCreditCard: false,
                  supportRFIDCard: false
                }
              }
            ],
            ocppStandardParameters: [
              {
                supportedFirmwareVersions: [
                  "3\\.[2-4]\\.0\\..*"
                ],
                supportedOcppVersions: [
                  "1.6"
                ],
                parameters: {
                  "AllowOfflineTxForUnknownId": "true",
                  "AuthorizationCacheEnabled": "false",
                  "StopTransactionOnInvalidId": "true"
                }
              }
            ],
            ocppVendorParameters: [
              {
                supportedFirmwareVersions: [
                  "3\\.2\\.0\\..*"
                ],
                supportedOcppVersions: [
                  "1.6"
                ],
                parameters: {
                  "authenticationmanager": "2",
                  "ocppconnecttimeout": "60",
                  "clockaligneddatainterval": "0",
                  "metervaluessampleddata": "Energy.Active.Import.Register,Current.Import,Current.Import.L1,Current.Import.L2,Current.Import.L3,Voltage,Voltage.L1,Voltage.L2,Voltage.L3",
                  "metervaluesampleinterval": "60",
                  "emsetting": "3",
                  "enableevdetection": "true",
                  "useautotimemanagment": "true",
                  "timeservername": "pool.ntp.org",
                  "monophasedloadsheddingfloorvalue": "6",
                  "triphasedloadsheddingfloorvalue": "6"
                }
              },
              {
                supportedFirmwareVersions: [
                  "3\\.[3-4]\\.0\\..*"
                ],
                supportedOcppVersions: [
                  "1.6"
                ],
                parameters: {
                  "authenticationmanager": "2",
                  "ocppconnecttimeout": "60",
                  "clockaligneddatainterval": "0",
                  "metervaluessampleddata": "Energy.Active.Import.Register,Current.Import,Current.Import.L1,Current.Import.L2,Current.Import.L3,Voltage,Voltage.L1,Voltage.L2,Voltage.L3",
                  "metervaluesampleinterval": "60",
                  "emsetting": "3",
                  "enableevdetection": "true",
                  "useautotimemanagment": "true",
                  "timeservername": "pool.ntp.org",
                  "websocketpinginterval": "30",
                  "monophasedloadsheddingfloorvalue": "6",
                  "triphasedloadsheddingfloorvalue": "6"
                }
              }
            ]
          }
        },
        // Template Delta~10616
        {
          id: null,
          template: {
            chargePointVendor: "DELTA",
            extraFilters: {
              chargePointModel: "10616"
            },
            technical: {
              maximumPower: 150000,
              voltage: 230,
              powerLimitUnit: ChargingRateUnitType.WATT,
              chargePoints: [
                {
                  chargePointID: 1,
                  currentType: CurrentType.DC,
                  amperage: 654,
                  numberOfConnectedPhase: 3,
                  cannotChargeInParallel: false,
                  sharePowerToAllConnectors: true,
                  excludeFromPowerLimitation: false,
                  ocppParamForPowerLimitation: "Device/GridCurrent",
                  power: 150000,
                  efficiency: 95,
                  voltage: null, // mandatory but never provided in the json templates
                  connectorIDs: [
                    1,
                    2
                  ]
                }
              ],
              connectors: [
                {
                  connectorId: 1,
                  type: ConnectorType.COMBO_CCS,
                  power: 150000,
                  chargePointID: 1
                },
                {
                  connectorId: 2,
                  type: ConnectorType.COMBO_CCS,
                  power: 150000,
                  chargePointID: 1
                }
              ]
            },
            capabilities: [
              {
                supportedFirmwareVersions: [
                  "3\\.[2-3]\\..*",
                  "3\\.4.*"
                ],
                supportedOcppVersions: [
                  "1.6"
                ],
                capabilities: {
                  supportStaticLimitation: true,
                  supportChargingProfiles: true,
                  supportRemoteStartStopTransaction: true,
                  supportUnlockConnector: true,
                  supportReservation: true,
                  supportCreditCard: false,
                  supportRFIDCard: true
                }
              }
            ],
            ocppStandardParameters: [
              {
                supportedFirmwareVersions: [
                  "3\\.[2-3]\\..*",
                  "3\\.4.*"
                ],
                supportedOcppVersions: [
                  "1.6"
                ],
                parameters: {
                  "AuthorizationCacheEnabled": "False",
                  "AuthorizeRemoteTxRequests": "True",
                  "ClockAlignedDataInterval": "0",
                  "ConnectionTimeOut": "60",
                  "LocalPreAuthorize": "True",
                  "LocalAuthorizeOffline": "True",
                  "StopTransactionOnInvalidId": "True",
                  "MeterValuesAlignedData": "0",
                  "MeterValueSampleInterval": "60",
                  "MeterValuesSampledData": "SoC,Energy.Active.Import.Register,Power.Active.Import,Current.Import,Voltage",
                  "StopTransactionOnEVSideDisconnect": "True",
                  "UnlockConnectorOnEVSideDisconnect": "True",
                  "WebSocketPingInterval": "30",
                }
              }
            ],
            ocppVendorParameters: [
              {
                supportedFirmwareVersions: [
                  "3\\.[2-3]\\..*",
                  "3\\.4.*"
                ],
                supportedOcppVersions: [
                  "1.6"
                ],
                parameters: {
                  "OCPP/idTagConversion": "HexZerofill4or7byte"
                }
              }
            ]
          }
        }
      ];
      for (const template of chargingStationTemplates) {
        template.createdOn = new Date();
        await ChargingStationTemplateStorage.saveChargingStationTemplate(template);
        created++;
      };
    } catch (error) {
      console.log(`>>>> Error while importing the charging station templates : ${error.message as string}`);
    }
    // Log in the default tenant
    console.log(`>>>> ${created} charging station template(s) created in the default tenant`);
  }
}

// Start
Bootstrap.start().catch(
  (error) => {
    Logging.logConsoleError(error.stack);
  }
);
