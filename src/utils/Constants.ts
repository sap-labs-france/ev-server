import { OCPPAttribute, OCPPLocation, OCPPMeasurand, OCPPPhase, OCPPReadingContext, OCPPUnitOfMeasure, OCPPValueFormat } from '../types/ocpp/OCPPServer';

import DbParams from '../types/database/DbParams';
import Logging from './Logging';
import { OcppParameter } from '../types/ChargingStation';
import Tenant from '../types/Tenant';

export default class Constants {
  public static readonly ONE_BILLION = 1000000000;

  public static readonly BOOT_NOTIFICATION_WAIT_TIME = 60;

  public static readonly CSV_SEPARATOR = ',';
  public static readonly CR_LF = '\r\n';

  public static readonly PERF_MAX_DATA_VOLUME_KB = 512;
  public static readonly PERF_MAX_RESPONSE_TIME_MILLIS = 3000;

  public static readonly AXIOS_DEFAULT_TIMEOUT_SECS = 30;

  public static readonly DC_CHARGING_STATION_DEFAULT_EFFICIENCY_PERCENT = 80;
  public static readonly AMPERAGE_DETECTION_THRESHOLD = 0.5;

  public static readonly DB_RECORD_COUNT_DEFAULT = 100;
  public static readonly DB_RECORD_COUNT_MAX_PAGE_LIMIT = 1000;
  public static readonly DB_RECORD_COUNT_CEIL = 500;
  public static readonly DB_RECORD_COUNT_NO_LIMIT = Number.MAX_SAFE_INTEGER;
  public static readonly DB_UNDETERMINED_NBR_OF_RECORDS = -1;
  public static readonly DB_EMPTY_DATA_RESULT = Object.freeze({ count: 0, result: [] });

  public static readonly DB_PARAMS_MAX_LIMIT: DbParams = Object.freeze({ limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, sort: null });
  public static readonly DB_PARAMS_SINGLE_RECORD: DbParams = Object.freeze({ limit: 1, skip: 0, sort: null });
  public static readonly DB_PARAMS_DEFAULT_RECORD: DbParams = Object.freeze({ limit: Constants.DB_RECORD_COUNT_DEFAULT, skip: 0, sort: null });
  public static readonly DB_PARAMS_COUNT_ONLY: DbParams = Object.freeze({ limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, onlyRecordCount: true, sort: null });
  public static readonly DB_MAX_PING_TIME_MILLIS = 3000;

  public static readonly EXPORT_PDF_PAGE_SIZE = 100;
  public static readonly EXPORT_PAGE_SIZE = 1000;
  public static readonly EXPORT_RECORD_MAX_COUNT = 100000;
  public static readonly IMPORT_PAGE_SIZE = 1000;
  public static readonly IMPORT_BATCH_INSERT_SIZE = 256;
  public static readonly BATCH_PAGE_SIZE = 256;

  public static readonly SFDP_LATTITUDE = 43.585784;
  public static readonly SFDP_LONGITUDE = 7.0377592;

  public static readonly LOCK_WAIT_MILLIS = 1000;

  public static readonly SMART_CHARGING_LOCK_SECS = 5;
  public static readonly CHARGING_STATION_LOCK_SECS = 5;
  public static readonly CHARGING_STATION_CONNECTION_LOCK_SECS = 5;
  public static readonly HEALTH_CHECK_ROUTE = '/health-check';

  public static readonly DEFAULT_TENANT_ID = 'default';
  public static readonly DEFAULT_TENANT_OBJECT = Object.freeze({
    id: Constants.DEFAULT_TENANT_ID,
    name: Constants.DEFAULT_TENANT_ID,
    subdomain: Constants.DEFAULT_TENANT_ID
  } as Tenant);

  // Output of crypto.getCiphers()
  public static readonly CRYPTO_SUPPORTED_ALGORITHM = Object.freeze([
    'aes-128-cbc',
    'aes-128-cbc-hmac-sha1',
    'aes-128-cbc-hmac-sha256',
    'aes-128-ccm',
    'aes-128-cfb',
    'aes-128-cfb1',
    'aes-128-cfb8',
    'aes-128-ctr',
    'aes-128-ecb',
    'aes-128-gcm',
    'aes-128-ocb',
    'aes-128-ofb',
    'aes-128-xts',
    'aes-192-cbc',
    'aes-192-ccm',
    'aes-192-cfb',
    'aes-192-cfb1',
    'aes-192-cfb8',
    'aes-192-ctr',
    'aes-192-ecb',
    'aes-192-gcm',
    'aes-192-ocb',
    'aes-192-ofb',
    'aes-256-cbc',
    'aes-256-cbc-hmac-sha1',
    'aes-256-cbc-hmac-sha256',
    'aes-256-ccm',
    'aes-256-cfb',
    'aes-256-cfb1',
    'aes-256-cfb8',
    'aes-256-ctr',
    'aes-256-ecb',
    'aes-256-gcm',
    'aes-256-ocb',
    'aes-256-ofb',
    'aes-256-xts',
    'aes128',
    'aes128-wrap',
    'aes192',
    'aes192-wrap',
    'aes256',
    'aes256-wrap',
    'aria-128-cbc',
    'aria-128-ccm',
    'aria-128-cfb',
    'aria-128-cfb1',
    'aria-128-cfb8',
    'aria-128-ctr',
    'aria-128-ecb',
    'aria-128-gcm',
    'aria-128-ofb',
    'aria-192-cbc',
    'aria-192-ccm',
    'aria-192-cfb',
    'aria-192-cfb1',
    'aria-192-cfb8',
    'aria-192-ctr',
    'aria-192-ecb',
    'aria-192-gcm',
    'aria-192-ofb',
    'aria-256-cbc',
    'aria-256-ccm',
    'aria-256-cfb',
    'aria-256-cfb1',
    'aria-256-cfb8',
    'aria-256-ctr',
    'aria-256-ecb',
    'aria-256-gcm',
    'aria-256-ofb',
    'aria128',
    'aria192',
    'aria256',
    'bf',
    'bf-cbc',
    'bf-cfb',
    'bf-ecb',
    'bf-ofb',
    'blowfish',
    'camellia-128-cbc',
    'camellia-128-cfb',
    'camellia-128-cfb1',
    'camellia-128-cfb8',
    'camellia-128-ctr',
    'camellia-128-ecb',
    'camellia-128-ofb',
    'camellia-192-cbc',
    'camellia-192-cfb',
    'camellia-192-cfb1',
    'camellia-192-cfb8',
    'camellia-192-ctr',
    'camellia-192-ecb',
    'camellia-192-ofb',
    'camellia-256-cbc',
    'camellia-256-cfb',
    'camellia-256-cfb1',
    'camellia-256-cfb8',
    'camellia-256-ctr',
    'camellia-256-ecb',
    'camellia-256-ofb',
    'camellia128',
    'camellia192',
    'camellia256',
    'cast',
    'cast-cbc',
    'cast5-cbc',
    'cast5-cfb',
    'cast5-ecb',
    'cast5-ofb',
    'chacha20',
    'chacha20-poly1305',
    'des',
    'des-cbc',
    'des-cfb',
    'des-cfb1',
    'des-cfb8',
    'des-ecb',
    'des-ede',
    'des-ede-cbc',
    'des-ede-cfb',
    'des-ede-ecb',
    'des-ede-ofb',
    'des-ede3',
    'des-ede3-cbc',
    'des-ede3-cfb',
    'des-ede3-cfb1',
    'des-ede3-cfb8',
    'des-ede3-ecb',
    'des-ede3-ofb',
    'des-ofb',
    'des3',
    'des3-wrap',
    'desx',
    'desx-cbc',
    'id-aes128-CCM',
    'id-aes128-GCM',
    'id-aes128-wrap',
    'id-aes128-wrap-pad',
    'id-aes192-CCM',
    'id-aes192-GCM',
    'id-aes192-wrap',
    'id-aes192-wrap-pad',
    'id-aes256-CCM',
    'id-aes256-GCM',
    'id-aes256-wrap',
    'id-aes256-wrap-pad',
    'id-smime-alg-CMS3DESwrap',
    'idea',
    'idea-cbc',
    'idea-cfb',
    'idea-ecb',
    'idea-ofb',
    'rc2',
    'rc2-128',
    'rc2-40',
    'rc2-40-cbc',
    'rc2-64',
    'rc2-64-cbc',
    'rc2-cbc',
    'rc2-cfb',
    'rc2-ecb',
    'rc2-ofb',
    'rc4',
    'rc4-40',
    'rc4-hmac-md5',
    'seed',
    'seed-cbc',
    'seed-cfb',
    'seed-ecb',
    'seed-ofb',
    'sm4',
    'sm4-cbc',
    'sm4-cfb',
    'sm4-ctr',
    'sm4-ecb',
    'sm4-ofb'
  ]);

  public static readonly UNKNOWN_OBJECT_ID: string = '000000000000000000000000';
  public static readonly UNKNOWN_STRING_ID: string = '000000000000000000000000';
  public static readonly UNKNOWN_NUMBER_ID: number = -1;

  public static readonly REST_RESPONSE_SUCCESS = Object.freeze({ status: 'Success' });

  public static readonly REST_CHARGING_STATION_COMMAND_RESPONSE_SUCCESS = Object.freeze({ status: 'Accepted' });

  public static readonly DELAY_SMART_CHARGING_EXECUTION_MILLIS = 3000;
  public static readonly DELAY_CHANGE_CONFIGURATION_EXECUTION_MILLIS = 10000;

  public static readonly CHARGING_STATION_CONFIGURATION = 'Configuration';

  public static readonly OCPI_SEPARATOR = '*';
  public static readonly OCPI_RECORDS_LIMIT = 25;
  public static readonly OCPI_MAX_PARALLEL_REQUESTS = 2;

  public static readonly ROAMING_AUTHORIZATION_TIMEOUT_MINS = 2;


  public static readonly MODULE_AXIOS = 'Axios';
  public static readonly MODULE_JSON_OCPP_SERVER_16 = 'OcppJ-16';
  public static readonly MODULE_SOAP_OCPP_SERVER_12 = 'OcppS-12';
  public static readonly MODULE_SOAP_OCPP_SERVER_15 = 'OcppS-15';
  public static readonly MODULE_SOAP_OCPP_SERVER_16 = 'OcppS-16';

  public static readonly OICP_PROGRESS_NOTIFICATION_MAX_INTERVAL = 300; // Hubject restriction: "Progress Notification can be sent only at interval of at least 300 seconds." (5 Minutes)
  public static readonly OICP_VIRTUAL_USER_EMAIL = 'virtual@oicp.com';

  public static readonly WITH_CHARGING_STATIONS = true; // Not used
  public static readonly WITHOUT_CHARGING_STATIONS = false; // Not used
  public static readonly WITH_SITE = true; // Not used
  public static readonly WITHOUT_SITE = false; // Not used

  // Password constants
  public static readonly PWD_MIN_LENGTH = 15;
  public static readonly PWD_MAX_LENGTH = 20;
  public static readonly PWD_UPPERCASE_MIN_COUNT = 1;
  public static readonly PWD_LOWERCASE_MIN_COUNT = 1;
  public static readonly PWD_NUMBER_MIN_COUNT = 1;
  public static readonly PWD_SPECIAL_MIN_COUNT = 1;

  public static readonly PWD_UPPERCASE_RE = /([A-Z])/g; // Cannot store regex in enum
  public static readonly PWD_LOWERCASE_RE = /([a-z])/g; // Cannot store regex in enum
  public static readonly PWD_NUMBER_RE = /([\d])/g; // Cannot store regex in enum
  public static readonly PWD_SPECIAL_CHAR_RE = /([!#$%^&*.?-])/g; // Cannot store regex in enum

  public static readonly SUPPORTED_LOCALES = Object.freeze(['en_US', 'fr_FR', 'es_ES', 'de_DE', 'pt_PT', 'it_IT', 'cs_CZ', 'en_AU']);
  public static readonly SUPPORTED_LANGUAGES = Object.freeze(['en', 'fr', 'es', 'de', 'pt', 'it', 'cs']);
  public static readonly DEFAULT_LOCALE = 'en_US';
  public static readonly DEFAULT_LANGUAGE = 'en';

  public static readonly ANONYMIZED_VALUE = '####';

  public static readonly WS_MAX_NBR_OF_FAILED_PINGS = 3;
  public static readonly WS_LOCK_TIME_OUT_MILLIS = 500;
  public static readonly WS_DEFAULT_KEEP_ALIVE_MILLIS = 180 * 1000;
  public static readonly WS_RECONNECT_DISABLED = 0;
  public static readonly WS_RECONNECT_UNLIMITED = -1;
  public static readonly WS_DEFAULT_RECONNECT_MAX_RETRIES = -1;
  public static readonly WS_DEFAULT_RECONNECT_TIMEOUT = 30; // Seconds
  public static readonly WS_CONNECTION_URL_RE = new RegExp(['^(?:(?:ws|wss)://)(?:\\S+)\\/(?:\\S+)\\/',
    '(?:[0-9a-f]{24})\\/',
    '([0-9a-f]{24})\\/',
    '(?:\\S+)$'].join(''), 'ig');

  public static readonly OCPP_SOCKET_TIMEOUT_MILLIS = 10 * 1000;
  public static readonly OCPP_HEARTBEAT_KEYS = Object.freeze(['HeartbeatInterval', 'HeartBeatInterval']);

  public static readonly MAX_DATE = new Date('9999-12-31Z23:59:59:999');
  public static readonly MIN_DATE = new Date('1970-01-01Z00:00:00:000');

  public static readonly REGEX_VALIDATION_LATITUDE = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)$/;
  public static readonly REGEX_VALIDATION_LONGITUDE = /^[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
  public static readonly REGEX_URL_PATTERN = /^(?:https?|wss?):\/\/((?:[\w-]+)(?:\.[\w-]+)*)(?:[\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?$/;
  public static readonly MAX_GPS_DISTANCE_METERS = 40000000; // Earth

  public static readonly CSV_CHARACTERS_TO_ESCAPE = /^[+\-@=].*$/;
  public static readonly CSV_ESCAPING_CHARACTER = '\'';

  public static readonly EXCEPTION_JSON_KEYS_IN_SENSITIVE_DATA = Object.freeze([
    'error', 'stack'
  ]);

  public static readonly SENSITIVE_DATA = Object.freeze([
    'firstName', 'name', 'repeatPassword', 'password', 'plainPassword', 'captcha', 'email'
  ]);

  public static readonly DEFAULT_OCPP_16_CONFIGURATION: OcppParameter[] = Object.freeze([
    { 'key': 'AllowOfflineTxForUnknownId', 'readonly': false, 'value': null },
    { 'key': 'AuthorizationCacheEnabled', 'readonly': false, 'value': null },
    { 'key': 'AuthorizeRemoteTxRequests', 'readonly': false, 'value': null },
    { 'key': 'BlinkRepeat', 'readonly': false, 'value': null },
    { 'key': 'ClockAlignedDataInterval', 'readonly': false, 'value': null },
    { 'key': 'ConnectionTimeOut', 'readonly': false, 'value': null },
    { 'key': 'GetConfigurationMaxKeys', 'readonly': false, 'value': null },
    { 'key': 'HeartbeatInterval', 'readonly': false, 'value': null },
    { 'key': 'LightIntensity', 'readonly': false, 'value': null },
    { 'key': 'LocalAuthorizeOffline', 'readonly': false, 'value': null },
    { 'key': 'LocalPreAuthorize', 'readonly': false, 'value': null },
    { 'key': 'MaxEnergyOnInvalidId', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesAlignedData', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesAlignedDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesSampledData', 'readonly': false, 'value': null },
    { 'key': 'MeterValuesSampledDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'MeterValueSampleInterval', 'readonly': false, 'value': null },
    { 'key': 'MinimumStatusDuration', 'readonly': false, 'value': null },
    { 'key': 'NumberOfConnectors', 'readonly': false, 'value': null },
    { 'key': 'ResetRetries', 'readonly': false, 'value': null },
    { 'key': 'ConnectorPhaseRotation', 'readonly': false, 'value': null },
    { 'key': 'ConnectorPhaseRotationMaxLength', 'readonly': false, 'value': null },
    { 'key': 'StopTransactionOnEVSideDisconnect', 'readonly': false, 'value': null },
    { 'key': 'StopTransactionOnInvalidId', 'readonly': false, 'value': null },
    { 'key': 'StopTxnAlignedData', 'readonly': false, 'value': null },
    { 'key': 'StopTxnAlignedDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'StopTxnSampledData', 'readonly': false, 'value': null },
    { 'key': 'StopTxnSampledDataMaxLength', 'readonly': false, 'value': null },
    { 'key': 'SupportedFeatureProfiles', 'readonly': false, 'value': null },
    { 'key': 'SupportedFeatureProfilesMaxLength', 'readonly': false, 'value': null },
    { 'key': 'TransactionMessageAttempts', 'readonly': false, 'value': null },
    { 'key': 'TransactionMessageRetryInterval', 'readonly': false, 'value': null },
    { 'key': 'UnlockConnectorOnEVSideDisconnect', 'readonly': false, 'value': null },
    { 'key': 'WebSocketPingInterval', 'readonly': false, 'value': null },
    { 'key': 'LocalAuthListEnabled', 'readonly': false, 'value': null },
    { 'key': 'LocalAuthListMaxLength', 'readonly': false, 'value': null },
    { 'key': 'SendLocalListMaxLength', 'readonly': false, 'value': null },
    { 'key': 'ReserveConnectorZeroSupported', 'readonly': false, 'value': null },
    { 'key': 'ChargeProfileMaxStackLevel', 'readonly': false, 'value': null },
    { 'key': 'ChargingScheduleAllowedChargingRateUnit', 'readonly': false, 'value': null },
    { 'key': 'ChargingScheduleMaxPeriods', 'readonly': false, 'value': null },
    { 'key': 'ConnectorSwitch3to1PhaseSupported', 'readonly': false, 'value': null },
    { 'key': 'MaxChargingProfilesInstalled', 'readonly': false, 'value': null }
  ]) as OcppParameter[];

  public static readonly OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE: OCPPAttribute = Object.freeze({
    unit: OCPPUnitOfMeasure.WATT_HOUR,
    context: OCPPReadingContext.SAMPLE_PERIODIC,
    measurand: OCPPMeasurand.ENERGY_ACTIVE_IMPORT_REGISTER,
    location: OCPPLocation.OUTLET,
    format: OCPPValueFormat.RAW,
  });

  public static readonly OCPP_SOC_ATTRIBUTE: OCPPAttribute = Object.freeze({
    unit: OCPPUnitOfMeasure.PERCENT,
    context: OCPPReadingContext.SAMPLE_PERIODIC,
    measurand: OCPPMeasurand.STATE_OF_CHARGE,
    location: OCPPLocation.EV,
    format: OCPPValueFormat.RAW,
  });

  public static readonly OCPP_START_SIGNED_DATA_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.SIGNED_DATA,
    context: OCPPReadingContext.TRANSACTION_BEGIN,
  });

  public static readonly OCPP_STOP_SIGNED_DATA_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.SIGNED_DATA,
    context: OCPPReadingContext.TRANSACTION_END,
  });

  public static readonly OCPP_VOLTAGE_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.RAW,
    measurand: OCPPMeasurand.VOLTAGE,
    unit: OCPPUnitOfMeasure.VOLT,
    location: OCPPLocation.OUTLET,
    context: OCPPReadingContext.SAMPLE_PERIODIC
  });

  public static readonly OCPP_VOLTAGE_L1_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_VOLTAGE_ATTRIBUTE,
    phase: OCPPPhase.L1,
  });

  public static readonly OCPP_VOLTAGE_L2_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_VOLTAGE_ATTRIBUTE,
    phase: OCPPPhase.L2,
  });

  public static readonly OCPP_VOLTAGE_L3_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_VOLTAGE_ATTRIBUTE,
    phase: OCPPPhase.L3,
  });

  public static readonly OCPP_CURRENT_IMPORT_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.RAW,
    measurand: OCPPMeasurand.CURRENT_IMPORT,
    unit: OCPPUnitOfMeasure.AMP,
    location: OCPPLocation.OUTLET,
    context: OCPPReadingContext.SAMPLE_PERIODIC
  });

  public static readonly OCPP_CURRENT_IMPORT_L1_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L1,
  });

  public static readonly OCPP_CURRENT_IMPORT_L2_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L2,
  });

  public static readonly OCPP_CURRENT_IMPORT_L3_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_CURRENT_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L3,
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE: OCPPAttribute = Object.freeze({
    format: OCPPValueFormat.RAW,
    measurand: OCPPMeasurand.POWER_ACTIVE_IMPORT,
    unit: OCPPUnitOfMeasure.WATT,
    location: OCPPLocation.OUTLET,
    context: OCPPReadingContext.SAMPLE_PERIODIC
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_L1_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L1,
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_L2_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L2,
  });

  public static readonly OCPP_POWER_ACTIVE_IMPORT_L3_ATTRIBUTE: OCPPAttribute = Object.freeze({
    ...Constants.OCPP_POWER_ACTIVE_IMPORT_ATTRIBUTE,
    phase: OCPPPhase.L3,
  });

  public static readonly AFIREV_MINIMAL_DURATION_THRESHOLD = 120; // Minimal duration - 2 minutes
  public static readonly AFIREV_MINIMAL_CONSUMPTION_THRESHOLD = 500; // Minimal consumption - 0.5 kW.h

  /* App Info for STRIPE */
  public static readonly STRIPE_APP_NAME = 'Open e-Mobility';
  public static readonly STRIPE_PARTNER_ID = 'TECH-000685';
  // public static readonly STRIPE_API_VERSION = '2020-08-27';
  public static readonly STRIPE_API_VERSION = '2022-11-15';

  public static readonly WEB_SOCKET_OCPP_NEW_CONNECTIONS_COUNT = 'web_socket_ocpp_new_connections_count';
  public static readonly WEB_SOCKET_OCPP_CLOSED_CONNECTIONS_COUNT = 'web_socket_ocpp_closed_connections_count';
  public static readonly WEB_SOCKET_OCPP_CONNECTIONS_COUNT = 'web_socket_ocpp_connections_count';
  public static readonly WEB_SOCKET_CURRENT_REQUEST = 'web_socket_current_request';
  public static readonly WEB_SOCKET_REST_CONNECTIONS_COUNT = 'web_socket_rest_connections_count';
  public static readonly WEB_SOCKET_RUNNING_REQUEST = 'web_socket_running_request';
  public static readonly WEB_SOCKET_RUNNING_REQUEST_RESPONSE = 'web_socket_running_request_response';
  public static readonly WEB_SOCKET_QUEUED_REQUEST = 'web_socket_queued_request';

  public static readonly MONGODB_CONNECTION_POOL_CREATED = 'mongodb_connectionPoolCreated';
  public static readonly MONGODB_CONNECTION_POOL_CLOSED = 'mongodb_connectionPoolClosed';
  public static readonly MONGODB_CONNECTION_CREATED = 'mongodb_connectionCreated';
  public static readonly MONGODB_CONNECTION_READY = 'mongodb_connectionReady';
  public static readonly MONGODB_CONNECTION_CLOSED = 'mongodb_connectionClosed';
  public static readonly MONGODB_CONNECTION_CHECK_OUT_STARTED = 'mongodb_connectionCheckOutStarted';
  public static readonly MONGODB_CONNECTION_CHECK_OUT_FAILED = 'mongodb_connectionCheckOutFailed';
  public static readonly MONGODB_CONNECTION_CHECK_OUT = 'mongodb_connectionCheckOut';
  public static readonly MONGODB_CONNECTION_CHECK_IN = 'mongodb_connectionCheckIn';
  public static readonly MONGODB_CONNECTION_POOL_CLEARED = 'mongodb_connectionPoolCleared';
}
