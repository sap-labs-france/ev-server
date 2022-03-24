import { OCPPAttribute, OCPPLocation, OCPPMeasurand, OCPPPhase, OCPPReadingContext, OCPPUnitOfMeasure, OCPPValueFormat } from '../types/ocpp/OCPPServer';

import DbParams from '../types/database/DbParams';
import { OcppParameter } from '../types/ChargingStation';
import Tenant from '../types/Tenant';

export default class Constants {
  public static readonly ONE_BILLION = 1000000000;

  public static readonly BOOT_NOTIFICATION_WAIT_TIME = 60;

  public static readonly CSV_SEPARATOR = ',';
  public static readonly CR_LF = '\r\n';

  public static readonly PERF_MAX_DATA_VOLUME_KB = 512;
  public static readonly PERF_MAX_RESPONSE_TIME_MILLIS = 1000;

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
  public static readonly IMPORT_BATCH_INSERT_SIZE = 250;
  public static readonly BATCH_PAGE_SIZE = 1000;

  public static readonly SFDP_LATTITUDE = 43.585784;
  public static readonly SFDP_LONGITUDE = 7.0377592;

  public static readonly LOCK_WAIT_MILLIS = 1000;

  public static readonly SMART_CHARGING_LOCK_SECS = 5;
  public static readonly CHARGING_STATION_LOCK_SECS = 5;
  public static readonly CHARGING_STATION_CONNECTION_LOCK_SECS = 5;
  public static readonly NO_IMAGE = 'data:image/png;base64,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ez6qI0CAwFQBbxamcpdaTOAoNW7NEiBAgACBNQICxxp3qxIgQIAAgVICAkepcWuWAAECBAisERA41rhblQABAgQIlBIQOEqNe26zfvlsrrfVCBAgEFlA4Ig8HbURIEBgooA3CROxCy4lcBQcupYJECBAgMBsge+zF7RePQH/WmW9met4PwFPN/ab2W4Ve8Kx28TUS4AAAQIENhTwhGPDoe1YsqccO05NzVUEPN2oMum1fXrCsda/zOp+oJUZtUYJECDwVEDgeMriRQIECNQQ8GagxpwjdOkjlQhTKFaDj1eKDVy7YQWEjbCjSVmYJxwpx6opAgQIfC0gbHzt47v9BTzh6G/qigcFPOk4COUwAh0FBI2OmC51SkDgOMXl4FECwscoWdetLiBgVL8D4vQvcMSZhUr+ExA+3AoEzgsIFufNnEGAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAwDqBvwG559gMHLRPmAAAAABJRU5ErkJggg=='
  public static readonly NO_CAR_IMAGE = 'data:image/png;base64,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';

  public static readonly HEALTH_CHECK_ROUTE = '/health-check';

  public static readonly DEFAULT_TENANT = 'default';
  public static readonly DEFAULT_TENANT_OBJECT = Object.freeze({
    id: Constants.DEFAULT_TENANT,
    name: Constants.DEFAULT_TENANT,
    subdomain: Constants.DEFAULT_TENANT
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
    'firstName', 'name', 'repeatPassword', 'password', 'plainPassword','captcha', 'email', 'coordinates', 'latitude', 'longitude',
    'Authorization', 'authorization', 'client_id', 'client_secret', 'refresh_token', 'localToken', 'Bearer', 'auth_token', 'token'
  ]);

  public static readonly MONGO_USER_MASK = Object.freeze({
    '_id': 0,
    '__v': 0,
    'email': 0,
    'phone': 0,
    'mobile': 0,
    'notificationsActive': 0,
    'notifications': 0,
    'iNumber': 0,
    'costCenter': 0,
    'status': 0,
    'createdBy': 0,
    'createdOn': 0,
    'lastChangedBy': 0,
    'lastChangedOn': 0,
    'role': 0,
    'password': 0,
    'locale': 0,
    'passwordWrongNbrTrials': 0,
    'passwordBlockedUntil': 0,
    'passwordResetHash': 0,
    'eulaAcceptedOn': 0,
    'eulaAcceptedVersion': 0,
    'eulaAcceptedHash': 0,
    'image': 0,
    'address': 0,
    'plateID': 0,
    'verificationToken': 0,
    'mobileLastChangedOn': 0,
    'issuer': 0,
    'mobileOs': 0,
    'mobileToken': 0,
    'verifiedAt': 0,
    'importedData': 0,
    'billingData': 0
  });

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
}
