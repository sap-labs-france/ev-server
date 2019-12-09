export default class Constants {
  public static readonly SOURCE_CHARGING_STATION_STATUS_ERROR = 'NotifyChargingStationStatusError';
  public static readonly SOURCE_CHARGING_STATION_REGISTERED = 'NotifyChargingStationRegistered';
  public static readonly SOURCE_END_OF_CHARGE = 'NotifyEndOfCharge';
  public static readonly SOURCE_OPTIMAL_CHARGE_REACHED = 'NotifyOptimalChargeReached';
  public static readonly SOURCE_END_OF_SESSION = 'NotifyEndOfSession';
  public static readonly SOURCE_REQUEST_PASSWORD = 'NotifyRequestPassword';
  public static readonly SOURCE_USER_ACCOUNT_STATUS_CHANGED = 'NotifyUserAccountStatusChanged';
  public static readonly SOURCE_NEW_REGISTERED_USER = 'NotifyNewRegisteredUser';
  public static readonly SOURCE_UNKNOWN_USER_BADGED = 'NotifyUnknownUserBadged';
  public static readonly SOURCE_TRANSACTION_STARTED = 'NotifyTransactionStarted';
  public static readonly SOURCE_VERIFICATION_EMAIL = 'NotifyVerificationEmail';
  public static readonly SOURCE_AUTH_EMAIL_ERROR = 'NotifyAuthentificationErrorEmailServer';
  public static readonly SOURCE_PATCH_EVSE_STATUS_ERROR = 'NotifyPatchEVSEStatusError';
  public static readonly SOURCE_USER_ACCOUNT_INACTIVITY = 'NotifyUserAccountInactivity';
  public static readonly SOURCE_PREPARING_SESSION_NOT_STARTED = 'NotifyPreparingSessionNotStarted';
  public static readonly SOURCE_OFFLINE_CHARGING_STATIONS = 'NotifyOfflineChargingStations';

  public static readonly CSV_SEPARATOR = '\t';

  public static readonly HTTP_GENERAL_ERROR = 500;
  public static readonly HTTP_NOT_IMPLEMENTED_ERROR = 501;
  public static readonly HTTP_OBJECT_DOES_NOT_EXIST_ERROR = 550;

  public static readonly HTTP_REFUND_SESSION_OTHER_USER_ERROR = 551;
  public static readonly HTTP_CONCUR_NO_CONNECTOR_CONNECTION_ERROR = 552;
  public static readonly HTTP_CONCUR_CITY_UNKNOWN_ERROR = 553;

  public static readonly HTTP_PRICING_REQUEST_INVOICE_ERROR = 561;

  public static readonly HTTP_CYPHER_INVALID_SENSITIVE_DATA_ERROR = 555;

  public static readonly HTTP_AUTH_ERROR = 560;
  public static readonly HTTP_AUTH_INVALID_CAPTCHA = 530;
  public static readonly HTTP_AUTH_INVALID_TOKEN_ERROR = 540;
  public static readonly HTTP_AUTH_CHARGER_WITH_NO_SITE_AREA_ERROR = 525;
  public static readonly HTTP_AUTH_SITE_AREA_WITH_NO_SITE_ERROR = 525;
  public static readonly HTTP_AUTH_USER_WITH_NO_SITE_ERROR = 525;

  public static readonly HTTP_EXISTING_TRANSACTION_ERROR = 570;

  public static readonly HTTP_USER_EMAIL_ALREADY_EXIST_ERROR = 510;
  public static readonly HTTP_USER_EULA_ERROR = 520;
  public static readonly HTTP_USER_ACCOUNT_ALREADY_ACTIVE_ERROR = 530;
  public static readonly HTTP_USER_TAG_ID_ALREADY_USED_ERROR = 540;
  public static readonly HTTP_USER_LOCKED_ERROR = 570;
  public static readonly HTTP_USER_NO_BADGE_ERROR = 570;
  public static readonly HTTP_USER_ACCOUNT_INACTIVE_ERROR = 580;
  public static readonly HTTP_USER_ACCOUNT_PENDING_ERROR = 590;

  public static readonly DB_RECORD_COUNT_DEFAULT = 100;
  public static readonly DB_RECORD_COUNT_CEIL = 2000;
  public static readonly DB_RECORD_COUNT_NO_LIMIT = Number.MAX_SAFE_INTEGER;

  public static readonly DB_PARAMS_MAX_LIMIT = { limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0 };
  public static readonly DB_PARAMS_SINGLE_RECORD = { limit: 1, skip: 0 };
  public static readonly DB_PARAMS_COUNT_ONLY = { limit: Constants.DB_RECORD_COUNT_NO_LIMIT, skip: 0, onlyRecordCount: true };
  public static readonly DEFAULT_TENANT = 'default';

  public static readonly REST_RESPONSE_SUCCESS = { status: 'Success' };

  public static readonly CONN_STATUS_AVAILABLE = 'Available';
  public static readonly CONN_STATUS_OCCUPIED = 'Occupied';
  public static readonly CONN_STATUS_CHARGING = 'Charging';
  public static readonly CONN_STATUS_FAULTED = 'Faulted';
  public static readonly CONN_STATUS_RESERVED = 'Reserved';
  public static readonly CONN_STATUS_FINISHING = 'Finishing';
  public static readonly CONN_STATUS_PREPARING = 'Preparing';
  public static readonly CONN_STATUS_SUSPENDED_EVSE = 'SuspendedEVSE';
  public static readonly CONN_STATUS_SUSPENDED_EV = 'SuspendedEV';
  public static readonly CONN_STATUS_UNAVAILABLE = 'Unavailable';

  public static readonly STATS_GROUP_BY_CONSUMPTION = 'C';
  public static readonly STATS_GROUP_BY_USAGE = 'U';
  public static readonly STATS_GROUP_BY_INACTIVITY = 'I';
  public static readonly STATS_GROUP_BY_TRANSACTIONS = 'T';
  public static readonly STATS_GROUP_BY_PRICING = 'P';

  public static readonly ENTITY_SITE = 'Site';
  public static readonly ENTITY_SITES = 'Sites';
  public static readonly ENTITY_SITE_AREA = 'SiteArea';
  public static readonly ENTITY_SITE_AREAS = 'SiteAreas';
  public static readonly ENTITY_COMPANY = 'Company';
  public static readonly ENTITY_COMPANIES = 'Companies';
  public static readonly ENTITY_CHARGING_STATION = 'ChargingStation';
  public static readonly ENTITY_CHARGING_STATIONS = 'ChargingStations';
  public static readonly ENTITY_TENANT = 'Tenant';
  public static readonly ENTITY_TENANTS = 'Tenants';
  public static readonly ENTITY_TRANSACTION = 'Transaction';
  public static readonly ENTITY_TRANSACTIONS = 'Transactions';
  public static readonly ENTITY_TRANSACTION_METER_VALUES = 'MeterValues';
  public static readonly ENTITY_TRANSACTION_STOP = 'Stop';
  public static readonly ENTITY_REPORT = 'Report';
  public static readonly ENTITY_USER = 'User';
  public static readonly ENTITY_USERS = 'Users';
  public static readonly ENTITY_VEHICLE_MANUFACTURER = 'VehicleManufacturer';
  public static readonly ENTITY_VEHICLE_MANUFACTURERS = 'VehicleManufacturers';
  public static readonly ENTITY_VEHICLES = 'Vehicles';
  public static readonly ENTITY_VEHICLE = 'Vehicle';
  public static readonly ENTITY_LOGGINGS = 'Loggings';
  public static readonly ENTITY_LOGGING = 'Logging';
  public static readonly ENTITY_PRICING = 'Pricing';
  public static readonly ENTITY_BILLING = 'Billing';
  public static readonly ENTITY_SETTING = 'Setting';
  public static readonly ENTITY_SETTINGS = 'Settings';
  public static readonly ENTITY_TOKENS = 'Tokens';
  public static readonly ENTITY_TOKEN = 'Token';
  public static readonly ENTITY_OCPI_ENDPOINT = 'OcpiEndpoint';
  public static readonly ENTITY_OCPI_ENDPOINTS = 'OcpiEndpoints';
  public static readonly ENTITY_CONNECTION = 'Connection';
  public static readonly ENTITY_CONNECTIONS = 'Connections';

  public static readonly VENDOR_SCHNEIDER = 'Schneider Electric';

  public static readonly NOTIF_TYPE_CHARGING_STATION_CONFIGURATION = 'Configuration';

  public static readonly CENTRAL_SERVER = 'Central Server';
  public static readonly OCPI_SERVER = 'OCPI Server';

  public static readonly WITH_CHARGING_STATIONS = true;
  public static readonly WITHOUT_CHARGING_STATIONS = false;
  public static readonly WITH_SITE = true;
  public static readonly WITHOUT_SITE = false;

  public static readonly VEHICLE_TYPE_CAR = 'C';

  // Statuses
  public static readonly USER_STATUS_PENDING = 'P';
  public static readonly USER_STATUS_ACTIVE = 'A';
  public static readonly USER_STATUS_DELETED = 'D';
  public static readonly USER_STATUS_INACTIVE = 'I';
  public static readonly USER_STATUS_BLOCKED = 'B';
  public static readonly USER_STATUS_LOCKED = 'L';

  // Roles
  public static readonly ROLE_SUPER_ADMIN = 'S';
  public static readonly ROLE_ADMIN = 'A';
  public static readonly ROLE_BASIC = 'B';
  public static readonly ROLE_DEMO = 'D';

  public static readonly ACTION_READ = 'Read';
  public static readonly ACTION_CREATE = 'Create';
  public static readonly ACTION_UPDATE = 'Update';
  public static readonly ACTION_DELETE = 'Delete';
  public static readonly ACTION_LOGOUT = 'Logout';
  public static readonly ACTION_LIST = 'List';
  public static readonly ACTION_RESET = 'Reset';
  public static readonly ACTION_AUTHORIZE = 'Authorize';
  public static readonly ACTION_CLEAR_CACHE = 'ClearCache';
  public static readonly ACTION_DATA_TRANSFER = 'DataTransfer';
  public static readonly ACTION_STOP_TRANSACTION = 'StopTransaction';
  public static readonly ACTION_REMOTE_STOP_TRANSACTION = 'RemoteStopTransaction';
  public static readonly ACTION_START_TRANSACTION = 'StartTransaction';
  public static readonly ACTION_REMOTE_START_TRANSACTION = 'RemoteStartTransaction';
  public static readonly ACTION_REFUND_TRANSACTION = 'RefundTransaction';
  public static readonly ACTION_UNLOCK_CONNECTOR = 'UnlockConnector';
  public static readonly ACTION_GET_CONFIGURATION = 'GetConfiguration';
  public static readonly ACTION_PING = 'Ping';
  public static readonly ACTION_SEND_EVSE_STATUSES = 'SendEVSEStatuses';
  public static readonly ACTION_SEND_TOKENS = 'SendTokens';
  public static readonly ACTION_REGISTER = 'Register';
  public static readonly ACTION_GENERATE_LOCAL_TOKEN = 'GenerateLocalToken';
  public static readonly ACTION_CHECK_CONNECTION_BILLING = 'CheckConnection';
  public static readonly ACTION_SYNCHRONIZE_BILLING = 'SynchronizeBilling';

  // Password constants
  public static readonly PWD_MIN_LENGTH = 15;
  public static readonly PWD_MAX_LENGTH = 20;
  public static readonly PWD_UPPERCASE_MIN_COUNT = 1;
  public static readonly PWD_LOWERCASE_MIN_COUNT = 1;
  public static readonly PWD_NUMBER_MIN_COUNT = 1;
  public static readonly PWD_SPECIAL_MIN_COUNT = 1;

  public static readonly PWD_UPPERCASE_RE = /([A-Z])/g;
  public static readonly PWD_LOWERCASE_RE = /([a-z])/g;
  public static readonly PWD_NUMBER_RE = /([\d])/g;
  public static readonly PWD_SPECIAL_CHAR_RE = /([!#$%^&*.?-])/g;

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

  public static readonly METER_VALUE_CTX_SAMPLE_PERIODIC = 'Sample.Periodic';
  public static readonly METER_VALUE_CTX_SAMPLE_CLOCK = 'Sample.Clock';
  public static readonly METER_VALUE_FORMAT_RAW = 'Raw';
  public static readonly METER_VALUE_MEASURAND_IMPREG = 'Energy.Active.Import.Register';
  public static readonly METER_VALUE_LOCATION_OUTLET = 'Outlet';
  public static readonly METER_VALUE_UNIT_WH = 'Wh';

  public static readonly CHARGER_VENDOR_EBEE = 'Bender GmbH Co. KG';
  public static readonly CHARGER_VENDOR_SCHNEIDER = 'Schneider Electric';
  public static readonly CHARGER_VENDOR_ABB = 'ABB';

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

  public static readonly OCPP_PROTOCOL_JSON = 'json';
  public static readonly OCPP_PROTOCOL_SOAP = 'soap';
  public static readonly OCPP_VERSION_12 = '1.2';
  public static readonly OCPP_VERSION_15 = '1.5';
  public static readonly OCPP_VERSION_16 = '1.6';
  public static readonly OCPP_VERSION_20 = '2.0';

  public static readonly REFUND_STATUS_SUBMITTED = 'submitted';
  public static readonly REFUND_STATUS_NOT_SUBMITTED = 'notSubmitted';
  public static readonly REFUND_STATUS_CANCELLED = 'cancelled';
  public static readonly REFUND_STATUS_APPROVED = 'approved';

  public static readonly REFUND_TYPE_REFUNDED = 'refunded';
  public static readonly REFUND_TYPE_NOT_REFUNDED = 'notRefunded';

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
    ANALYTICS: 'analytics'
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

  public static readonly MOBILE_OS_ANDROID = 'android';
  public static readonly MOBILE_OS_IOS = 'ios';
}
