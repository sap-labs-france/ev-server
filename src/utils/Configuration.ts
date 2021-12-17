import AsyncTaskConfiguration from '../types/configuration/AsyncTaskConfiguration';
import AuthorizationConfiguration from '../types/configuration/AuthorizationConfiguration';
import AxiosConfiguration from '../types/configuration/AxiosConfiguration';
import CentralSystemConfiguration from '../types/configuration/CentralSystemConfiguration';
import CentralSystemFrontEndConfiguration from '../types/configuration/CentralSystemFrontEndConfiguration';
import CentralSystemRestServiceConfiguration from '../types/configuration/CentralSystemRestServiceConfiguration';
import CentralSystemServerConfiguration from '../types/configuration/CentralSystemServerConfiguration';
import ChargingStationConfiguration from '../types/configuration/ChargingStationConfiguration';
import { Configuration as ConfigurationData } from '../types/configuration/Configuration';
import Constants from './Constants';
import CryptoConfiguration from '../types/configuration/CryptoConfiguration';
import EVDatabaseConfiguration from '../types/configuration/EVDatabaseConfiguration';
import EmailConfiguration from '../types/configuration/EmailConfiguration';
import FirebaseConfiguration from '../types/configuration/FirebaseConfiguration';
import JsonEndpointConfiguration from '../types/configuration/JsonEndpointConfiguration';
import LoggingConfiguration from '../types/configuration/LoggingConfiguration';
import MigrationConfiguration from '../types/configuration/MigrationConfiguration';
import NotificationConfiguration from '../types/configuration/NotificationConfiguration';
import OCPIEndpointConfiguration from '../types/configuration/OCPIEndpointConfiguration';
import OCPIServiceConfiguration from '../types/configuration/OCPIServiceConfiguration';
import ODataServiceConfiguration from '../types/configuration/ODataServiceConfiguration';
import OICPEndpointConfiguration from '../types/configuration/OICPEndpointConfiguration';
import OICPServiceConfiguration from '../types/configuration/OICPServiceConfiguration';
import SchedulerConfiguration from '../types/configuration/SchedulerConfiguration';
import StorageConfiguration from '../types/configuration/StorageConfiguration';
import WSDLEndpointConfiguration from '../types/configuration/WSDLEndpointConfiguration';
import chalk from 'chalk';
import fs from 'fs';
import global from './../types/GlobalType';

const MODULE_NAME = 'Configuration';

export default class Configuration {
  private static config: ConfigurationData;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getCryptoConfig(): CryptoConfiguration {
    const crypto = Configuration.getConfig().Crypto;
    if (!Configuration.isUndefined('Crypto', crypto)) {
      return crypto;
    }
  }

  public static getSchedulerConfig(): SchedulerConfiguration {
    const scheduler = Configuration.getConfig().Scheduler;
    if (!Configuration.isUndefined('Scheduler', scheduler)) {
      return scheduler;
    }
  }

  public static getAsyncTaskConfig(): AsyncTaskConfiguration {
    const asyncTask = Configuration.getConfig().AsyncTask;
    if (!Configuration.isUndefined('AsyncTask', asyncTask)) {
      return asyncTask;
    }
  }

  public static getFirebaseConfig(): FirebaseConfiguration {
    const firebaseConfiguration = Configuration.getConfig().Firebase;
    if (!Configuration.isUndefined('Firebase', firebaseConfiguration)) {
      if (firebaseConfiguration.privateKey) {
        firebaseConfiguration.privateKey = firebaseConfiguration.privateKey.replace(/\\n/g, '\n');
      }
      return firebaseConfiguration;
    }
  }

  public static getCentralSystemsConfig(): CentralSystemConfiguration[] {
    const centralSystems = Configuration.getConfig().CentralSystems;
    if (!Configuration.isUndefined('CentralSystems', centralSystems)) {
      return centralSystems;
    }
  }

  public static getNotificationConfig(): NotificationConfiguration {
    const notification = Configuration.getConfig().Notification;
    if (!Configuration.isUndefined('Notification', notification)) {
      return notification;
    }
  }

  public static getAuthorizationConfig(): AuthorizationConfiguration {
    const authorization = Configuration.getConfig().Authorization;
    if (!Configuration.isUndefined('Authorization', authorization)) {
      return authorization;
    }
  }

  public static getCentralSystemRestServiceConfig(): CentralSystemRestServiceConfiguration {
    const centralSystemRestService = Configuration.getConfig().CentralSystemRestService;
    if (!Configuration.isUndefined('CentralSystemRestService', centralSystemRestService)) {
      return centralSystemRestService;
    }
  }

  public static getOCPIServiceConfig(): OCPIServiceConfiguration {
    const ocpiService = Configuration.getConfig().OCPIService;
    if (!Configuration.isUndefined('OCPIService', ocpiService)) {
      return ocpiService;
    }
  }

  public static getOICPServiceConfig(): OICPServiceConfiguration {
    const oicpService = Configuration.getConfig().OICPService;
    if (!Configuration.isUndefined('OICPService', oicpService)) {
      return oicpService;
    }
  }

  public static getODataServiceConfig(): ODataServiceConfiguration {
    const odataService = Configuration.getConfig().ODataService;
    if (!Configuration.isUndefined('ODataService', odataService)) {
      return odataService;
    }
  }

  public static getCentralSystemRestServerConfig(): CentralSystemServerConfiguration {
    const centralSystemServer = Configuration.getConfig().CentralSystemServer;
    if (!Configuration.isUndefined('CentralSystemServer', centralSystemServer)) {
      return centralSystemServer;
    }
  }

  public static getWSDLEndpointConfig(): WSDLEndpointConfiguration {
    const wsdlEndpoint = Configuration.getConfig().WSDLEndpoint;
    if (!Configuration.isUndefined('WSDLEndpoint', wsdlEndpoint)) {
      return wsdlEndpoint;
    }
  }

  public static getJsonEndpointConfig(): JsonEndpointConfiguration {
    const jsonEndpoint = Configuration.getConfig().JsonEndpoint;
    if (!Configuration.isUndefined('JsonEndpoint', jsonEndpoint)) {
      return jsonEndpoint;
    }
  }

  public static getOCPIEndpointConfig(): OCPIEndpointConfiguration {
    const ocpiEndpoint = Configuration.getConfig().OCPIEndpoint;
    if (!Configuration.isUndefined('OCPIEndpoint', ocpiEndpoint)) {
      return ocpiEndpoint;
    }
  }

  public static getOICPEndpointConfig(): OICPEndpointConfiguration {
    const oicpPEndpoint = Configuration.getConfig().OICPEndpoint;
    if (!Configuration.isUndefined('OICPEndpoint', oicpPEndpoint)) {
      return oicpPEndpoint;
    }
  }

  public static getCentralSystemFrontEndConfig(): CentralSystemFrontEndConfiguration {
    const centralSystemFrontEnd = Configuration.getConfig().CentralSystemFrontEnd;
    if (!Configuration.isUndefined('CentralSystemFrontEnd', centralSystemFrontEnd)) {
      return centralSystemFrontEnd;
    }
  }

  public static getEmailConfig(): EmailConfiguration {
    const email = Configuration.getConfig().Email;
    if (!Configuration.isUndefined('Email', email)) {
      if (Configuration.isUndefined('Email.disableBackup', email.disableBackup)) {
        email.disableBackup = false;
      }
      return email;
    }
  }

  public static getEVDatabaseConfig(): EVDatabaseConfiguration {
    const evDatabase = Configuration.getConfig().EVDatabase;
    if (!Configuration.isUndefined('EVDatabase', evDatabase)) {
      return evDatabase;
    }
  }

  public static getStorageConfig(): StorageConfiguration {
    const storage = Configuration.getConfig().Storage;
    if (!Configuration.isUndefined('Storage', storage)) {
      return storage;
    }
  }

  public static getChargingStationConfig(): ChargingStationConfiguration {
    // Read conf and set defaults values
    const chargingStationConfiguration: ChargingStationConfiguration = Configuration.getConfig().ChargingStation;
    if (!Configuration.isUndefined('ChargingStation', chargingStationConfiguration)) {
      if (Configuration.isUndefined('ChargingStation.heartbeatIntervalOCPPSSecs', chargingStationConfiguration.heartbeatIntervalOCPPSSecs)) {
        chargingStationConfiguration.heartbeatIntervalOCPPSSecs = 60;
      }
      if (Configuration.isUndefined('ChargingStation.heartbeatIntervalOCPPJSecs', chargingStationConfiguration.heartbeatIntervalOCPPJSecs)) {
        chargingStationConfiguration.heartbeatIntervalOCPPJSecs = 3600;
      }
      if (Configuration.isUndefined('ChargingStation.pingIntervalOCPPJSecs', chargingStationConfiguration.pingIntervalOCPPJSecs)) {
        chargingStationConfiguration.pingIntervalOCPPJSecs = 60;
      }
      if (Configuration.isUndefined('ChargingStation.monitoringIntervalOCPPJSecs', chargingStationConfiguration.monitoringIntervalOCPPJSecs)) {
        chargingStationConfiguration.monitoringIntervalOCPPJSecs = 600;
      }
    }
    return chargingStationConfiguration;
  }

  public static getLoggingConfig(): LoggingConfiguration {
    const logging = Configuration.getConfig().Logging;
    if (!Configuration.isUndefined('Logging', logging)) {
      return logging;
    }
  }

  public static getMigrationConfig(): MigrationConfiguration {
    const migration = Configuration.getConfig().Migration;
    if (!Configuration.isUndefined('Migration', migration)) {
      if (Configuration.isUndefined('Migration.active', Configuration.getConfig().Migration.active)) {
        migration.active = false;
      }
      return migration;
    }
  }

  public static getAxiosConfig(): AxiosConfiguration {
    const axios = Configuration.getConfig().Axios;
    if (!Configuration.isUndefined('Axios', axios)) {
      if (Configuration.isUndefined('Axios.timeout', axios.timeout)) {
        axios.timeout = Constants.AXIOS_DEFAULT_TIMEOUT;
      }
      if (Configuration.isUndefined('Axios.retries', axios.retries)) {
        axios.retries = 0;
      }
      return axios;
    }
  }

  private static getConfig(): ConfigurationData {
    if (!Configuration.config) {
      Configuration.config = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/config.json`, 'utf8')) as ConfigurationData;
    }
    return Configuration.config;
  }

  // Dup method: Avoid circular deps with Utils class
  private static isUndefined(name: string, value: any): boolean {
    if (typeof value === 'undefined') {
      console.error(chalk.red(`Missing property '${name}' in config.json`));
      return true;
    }
    return false;
  }
}
