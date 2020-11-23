import AuthorizationConfiguration from './AuthorizationConfiguration';
import AxiosConfiguration from './AxiosConfiguration';
import CentralSystemConfiguration from './CentralSystemConfiguration';
import CentralSystemFrontEndConfiguration from './CentralSystemFrontEndConfiguration';
import CentralSystemRestServiceConfiguration from './CentralSystemRestServiceConfiguration';
import CentralSystemServerConfiguration from './CentralSystemServer';
import ChargingStationConfiguration from './ChargingStationConfiguration';
import ChargingStationTemplatesConfiguration from './ChargingStationTemplatesConfiguration';
import ClusterConfiguration from './ClusterConfiguration';
import CryptoConfiguration from './CryptoConfiguration';
import EVDatabaseConfiguration from './EVDatabaseConfiguration';
import EmailConfiguration from './EmailConfiguration';
import FirebaseConfiguration from './FirebaseConfiguration';
import HealthCheckConfiguration from './HealthCheckConfiguration';
import JsonEndpointConfiguration from './JsonEndpointConfiguration';
import LocalesConfiguration from './LocalesConfiguration';
import LoggingConfiguration from './LoggingConfiguration';
import MigrationConfiguration from './MigrationConfiguration';
import NotificationConfiguration from './NotificationConfiguration';
import OCPIEndpointConfiguration from './OCPIEndpointConfiguration';
import OCPIServiceConfiguration from './OCPIServiceConfiguration';
import ODataServiceConfiguration from './ODataServiceConfiguration';
import SchedulerConfiguration from './SchedulerConfiguration';
import StorageConfiguration from './StorageConfiguration';
import WSClientConfiguration from './WSClientConfiguration';
import WSDLEndpointConfiguration from './WSDLEndpointConfiguration';

export interface Configuration {
  Crypto: CryptoConfiguration;
  Cluster?: ClusterConfiguration;
  CentralSystemServer: CentralSystemServerConfiguration;
  CentralSystems: CentralSystemConfiguration[];
  CentralSystemRestService: CentralSystemRestServiceConfiguration;
  CentralSystemFrontEnd: CentralSystemFrontEndConfiguration;
  WSDLEndpoint: WSDLEndpointConfiguration;
  JsonEndpoint: JsonEndpointConfiguration;
  OCPIEndpoint: OCPIEndpointConfiguration;
  WSClient: WSClientConfiguration;
  OCPIService: OCPIServiceConfiguration;
  ODataService: ODataServiceConfiguration;
  Firebase: FirebaseConfiguration;
  Email: EmailConfiguration;
  Storage: StorageConfiguration;
  Notification: NotificationConfiguration;
  Authorization: AuthorizationConfiguration;
  ChargingStation: ChargingStationConfiguration;
  Locales?: LocalesConfiguration;
  Scheduler: SchedulerConfiguration;
  Logging: LoggingConfiguration;
  HealthCheck?: HealthCheckConfiguration;
  Migration?: MigrationConfiguration;
  EVDatabase?: EVDatabaseConfiguration;
  ChargingStationTemplates?: ChargingStationTemplatesConfiguration;
  Axios?: AxiosConfiguration
}

export type ConfigurationSection = CryptoConfiguration|ClusterConfiguration|CentralSystemServerConfiguration|CentralSystemConfiguration|CentralSystemRestServiceConfiguration|CentralSystemFrontEndConfiguration|WSDLEndpointConfiguration|JsonEndpointConfiguration|OCPIEndpointConfiguration|WSClientConfiguration|OCPIServiceConfiguration|ODataServiceConfiguration|FirebaseConfiguration|EmailConfiguration|StorageConfiguration|NotificationConfiguration|AuthorizationConfiguration|ChargingStationConfiguration|SchedulerConfiguration|LocalesConfiguration|LoggingConfiguration|HealthCheckConfiguration|MigrationConfiguration|EVDatabaseConfiguration|ChargingStationTemplatesConfiguration|AxiosConfiguration;
