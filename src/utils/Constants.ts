import Tenant from '../types/Tenant';

export default class Constants {
  public static readonly CSV_SEPARATOR = '\t'; // Cannot store Regex ind enum

  public static readonly DB_RECORD_COUNT_DEFAULT = 100;
  public static readonly DB_RECORD_COUNT_CEIL = 2000;
  public static readonly DB_RECORD_COUNT_NO_LIMIT = Number.MAX_SAFE_INTEGER;

  public static readonly DB_PARAMS_MAX_LIMIT = { limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0 };
  public static readonly DB_PARAMS_SINGLE_RECORD = { limit: 1, skip: 0 };
  public static readonly DB_PARAMS_COUNT_ONLY = { limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, onlyRecordCount: true };
  public static readonly DEFAULT_TENANT = 'default';
  public static readonly DEFAULT_TENANT_OBJECT= {
    id: Constants.DEFAULT_TENANT,
    name: Constants.DEFAULT_TENANT
  } as Tenant;

  public static readonly REST_RESPONSE_SUCCESS = { status: 'Success' };

  public static readonly STATS_GROUP_BY_CONSUMPTION = 'C';
  public static readonly STATS_GROUP_BY_USAGE = 'U';
  public static readonly STATS_GROUP_BY_INACTIVITY = 'I';
  public static readonly STATS_GROUP_BY_TRANSACTIONS = 'T';
  public static readonly STATS_GROUP_BY_PRICING = 'P';

  public static readonly NOTIF_TYPE_CHARGING_STATION_CONFIGURATION = 'Configuration';

  public static readonly CENTRAL_SERVER = 'Central Server';
  public static readonly OCPI_SERVER = 'OCPI Server';

  public static readonly WITH_CHARGING_STATIONS = true; // Not used
  public static readonly WITHOUT_CHARGING_STATIONS = false; // Not used
  public static readonly WITH_SITE = true; // Not used
  public static readonly WITHOUT_SITE = false; // Not used

  public static readonly VEHICLE_TYPE_CAR = 'C';

  // Password constants
  public static readonly PWD_MIN_LENGTH = 15;
  public static readonly PWD_MAX_LENGTH = 20;
  public static readonly PWD_UPPERCASE_MIN_COUNT = 1;
  public static readonly PWD_LOWERCASE_MIN_COUNT = 1;
  public static readonly PWD_NUMBER_MIN_COUNT = 1;
  public static readonly PWD_SPECIAL_MIN_COUNT = 1;

  public static readonly PWD_UPPERCASE_RE = /([A-Z])/g; // Cannot store Regex ind enum
  public static readonly PWD_LOWERCASE_RE = /([a-z])/g; // Cannot store Regex ind enum
  public static readonly PWD_NUMBER_RE = /([\d])/g; // Cannot store Regex ind enum
  public static readonly PWD_SPECIAL_CHAR_RE = /([!#$%^&*.?-])/g; // Cannot store Regex ind enum

  public static readonly SUPPORTED_LOCALES = ['en_US', 'fr_FR'];
  public static readonly SUPPORTED_LANGUAGES = ['en', 'fr'];
  public static readonly DEFAULT_LOCALE = 'en_US';
  public static readonly DEFAULT_LANGUAGE = 'en';

  public static readonly ANONYMIZED_VALUE = '####';

  public static readonly SETTING_PRICING_CONTENT_TYPE_SIMPLE = 'simple';
  public static readonly SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING = 'convergentCharging';
  public static readonly SETTING_REFUND_CONTENT_TYPE_CONCUR = 'concur';
  public static readonly SETTING_REFUND_CONTENT_TYPE_GIREVE = 'gireve';
  public static readonly SETTING_REFUND_CONTENT_TYPE_OCPI = 'ocpi';
  public static readonly SETTING_REFUND_CONTENT_TYPE_SAC = 'sac';
  public static readonly SETTING_BILLING_CONTENT_TYPE_STRIPE = 'stripe';
  public static readonly SETTING_SMART_CHARGING_CONTENT_TYPE_SAP_SMART_CHARGING = 'sapSmartCharging';

  public static readonly WS_DEFAULT_KEEPALIVE = 30; // Seconds
  public static readonly WS_RECONNECT_DISABLED = 0;
  public static readonly WS_RECONNECT_UNLIMITED = -1;
  public static readonly WS_DEFAULT_RECONNECT_MAX_RETRIES = -1;
  public static readonly WS_DEFAULT_RECONNECT_TIMEOUT = 30; // Seconds
  public static readonly WS_UNSUPPORTED_DATA = 1007;

  public static readonly OCPP_SOCKET_TIMEOUT = 30000; // 30 sec
  public static readonly OCPP_JSON_CALL_MESSAGE = 2; // Client-to-Server
  public static readonly OCPP_JSON_CALL_RESULT_MESSAGE = 3; // Server-to-Client
  public static readonly OCPP_JSON_CALL_ERROR_MESSAGE = 4; // Server-to-Client
  // Requested Action is not known by receiver
  public static readonly OCPP_ERROR_NOT_IMPLEMENTED = 'NotImplemented';
  // Requested Action is recognized but not supported by the receiver
  public static readonly OCPP_ERROR_NOT_SUPPORTED = 'NotSupported';
  // An internal error occurred and the receiver was not able to process the requested Action successfully
  public static readonly OCPP_ERROR_INTERNAL_ERROR = 'InternalError';
  // Payload for Action is incomplete
  public static readonly OCPP_ERROR_PROTOCOL_ERROR = 'ProtocolError';
  // During the processing of Action a security issue occurred preventing receiver from completing the Action successfully
  public static readonly OCPP_ERROR_SECURITY_ERROR = 'SecurityError';
  // Payload for Action is syntactically incorrect or not conform the PDU structure for Action
  public static readonly OCPP_ERROR_FORMATION_VIOLATION = 'FormationViolation';
  // Payload is syntactically correct but at least one field contains an invalid value
  public static readonly OCPP_ERROR_PROPERTY_RAINT_VIOLATION = 'PropertyraintViolation';
  // Payload for Action is syntactically correct but at least one of the fields violates occurence raints
  public static readonly OCPP_ERROR_OCCURENCE_RAINT_VIOLATION = 'OccurenceraintViolation';
  // Payload for Action is syntactically correct but at least one of the fields violates data type raints (e.g. "somestring" = 12)
  public static readonly OCPP_ERROR_TYPERAINT_VIOLATION = 'TyperaintViolation';
  // Any other error not covered by the previous ones
  public static readonly OCPP_ERROR_GENERIC_ERROR = 'GenericError';
  public static readonly OCPP_RESPONSE_ACCEPTED = 'Accepted';

  public static readonly BILLING_STATUS_UNBILLED = 'unbilled';
  public static readonly BILLING_STATUS_BILLED = 'billed';

  public static readonly BILLING_METHOD_IMMEDIATE = 'immediate';
  public static readonly BILLING_METHOD_PERIODIC = 'periodic';
  public static readonly BILLING_METHOD_ADVANCE = 'advance';

  public static readonly MAX_DATE = new Date('9999-12-31Z23:59:59:999');
  public static readonly MIN_DATE = new Date('1970-01-01Z00:00:00:000');

  // --------------------------------------------------------------------
  // OCPI Constants
  // --------------------------------------------------------------------
  // OCPI Base Path
  public static readonly OCPI_SERVER_CPO_PATH = '/ocpi/cpo';
  public static readonly OCPI_SERVER_EMSP_PATH = '/ocpi/emsp';
  public static readonly OCPI_VERSIONS_PATH = '/versions';
  // OCPI Available Response Status
  public static readonly OCPI_STATUS_CODE = {
    // 1*** SUCCESS
    CODE_1000_SUCCESS: { status_code: 1000, status_message: 'Success' },

    // 2*** CLIENT ERROR
    CODE_2000_GENERIC_CLIENT_ERROR: { status_code: 2000, status_message: 'Generic Client Error' },
    CODE_2001_INVALID_PARAMETER_ERROR: { status_code: 2001, status_message: 'Invalid or Missing Parameters' },
    CODE_2002_NOT_ENOUGH_INFORMATION_ERROR: { status_code: 2002, status_message: 'Not enough information' },
    CODE_2003_UNKNOW_LOCATION_ERROR: { status_code: 2003, status_message: 'Unknown Location' },

    // 3*** SERVER ERROR
    CODE_3000_GENERIC_SERVER_ERROR: { status_code: 3000, status_message: 'Generic Server Error' },
    CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR: { status_code: 3001, status_message: 'Unable to Use Client API' },
    CODE_3002_UNSUPPORTED_VERSION_ERROR: { status_code: 3002, status_message: 'Unsupported Version' },
    CODE_3003_NO_MATCHING_ENDPOINTS_ERROR: { status_code: 3003, status_message: 'No Matching Endpoints' }
  };

  public static readonly OCPI_ROLE = {
    CPO: 'CPO',
    EMSP: 'EMSP'
  };

  // OCPI EVSE STATUS
  public static readonly EVSE_STATUS = {
    AVAILABLE: 'AVAILABLE',
    BLOCKED: 'BLOCKED',
    CHARGING: 'CHARGING',
    INOPERATIVE: 'INOPERATIVE',
    OUTOFORDER: 'OUTOFORDER',
    PLANNED: 'PLANNED',
    REMOVED: 'REMOVED',
    RESERVED: 'RESERVED',
    UNKNOWN: 'UNKNOWN'
  };

  // OCPI CONNECTOR POWER TYPE
  public static readonly CONNECTOR_POWER_TYPE = {
    AC_1_PHASE: 'AC_1_PHASE',
    AC_3_PHASE: 'AC_3_PHASE',
    DC: 'DC'
  };

  // CONNECTOR TYPE
  public static readonly MAPPING_CONNECTOR_TYPE = {
    'C': 'CHADEMO',
    'T2': 'IEC_62196_T2',
    'CCS': 'IEC_62196_T2_COMBO'
  };

  public static readonly CONNECTOR_TYPES = {
    'UNKNOWN': 'U',
    'CHADEMO': 'C',
    'IEC_62196_T2': 'T2',
    'IEC_62196_T2_COMBO': 'CCS',
    'DOMESTIC': 'D',
    'TYPE_1': 'T1',
    'TYPE_1_CCS': 'T1CCS',
    'TYPE_3C': 'T3C',
  };

  // Components
  public static readonly COMPONENTS = {
    OCPI: 'ocpi',
    REFUND: 'refund',
    PRICING: 'pricing',
    BILLING: 'billing',
    ORGANIZATION: 'organization',
    STATISTICS: 'statistics',
    ANALYTICS: 'analytics',
    SMART_CHARGING: 'smartCharging',
    BUILDING: 'building'
  };

  // Ocpi Registering status
  public static readonly OCPI_REGISTERING_STATUS = {
    OCPI_NEW: 'new',
    OCPI_REGISTERED: 'registered',
    OCPI_UNREGISTERED: 'unregistered'
  };

  public static readonly MONGO_USER_MASK = {
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
    'deleted': 0,
    'passwordWrongNbrTrials': 0,
    'passwordBlockedUntil': 0,
    'passwordResetHash': 0,
    'eulaAcceptedOn': 0,
    'eulaAcceptedVersion': 0,
    'eulaAcceptedHash': 0,
    'image': 0,
    'address': 0,
    'plateID': 0,
    'verificationToken': 0
  };

  public static readonly MOBILE_OS_ANDROID = 'android'; // Not used
  public static readonly MOBILE_OS_IOS = 'ios'; // Not used
}
