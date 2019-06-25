import SourceMap from 'source-map-support';
SourceMap.install();

export default {
  HTTP_GENERAL_ERROR: 500,
  HTTP_NOT_IMPLEMENTED_ERROR: 501,
  HTTP_OBJECT_DOES_NOT_EXIST_ERROR: 550,

  HTTP_REFUND_SESSION_OTHER_USER_ERROR: 551,
  HTTP_CONCUR_NO_CONNECTOR_CONNECTION_ERROR: 552,
  HTTP_CONCUR_CITY_UNKNOWN_ERROR: 553,

  HTTP_PRICING_REQUEST_INVOICE_ERROR: 561,

  HTTP_CYPHER_INVALID_SENSITIVE_DATA_ERROR: 555,

  HTTP_AUTH_ERROR: 560,
  HTTP_INVALID_TOKEN_ERROR: 540,
  HTTP_AUTH_CHARGER_WITH_NO_SITE_AREA_ERROR: 525,
  HTTP_AUTH_SITE_AREA_WITH_NO_SITE_ERROR: 525,
  HTTP_AUTH_USER_WITH_NO_SITE_ERROR: 525,

  HTTP_EXISTING_TRANSACTION_ERROR: 570,

  HTTP_USER_EULA_ERROR: 520,
  HTTP_USER_EMAIL_ALREADY_EXIST_ERROR: 510,
  HTTP_USER_ACCOUNT_ALREADY_ACTIVE_ERROR: 530,
  HTTP_USER_LOCKED_ERROR: 570,
  HTTP_USER_NO_BADGE_ERROR: 570,
  HTTP_USER_ACCOUNT_INACTIVE_ERROR: 580,
  HTTP_USER_ACCOUNT_PENDING_ERROR: 590,

  MAX_DB_RECORD_COUNT: 2000,

  DEFAULT_TENANT: 'default',

  REST_RESPONSE_SUCCESS: { status: 'Success' },

  CONN_STATUS_AVAILABLE: "Available",
  CONN_STATUS_OCCUPIED: "Occupied",
  CONN_STATUS_CHARGING: "Charging",
  CONN_STATUS_FAULTED: "Faulted",
  CONN_STATUS_RESERVED: "Reserved",
  CONN_STATUS_FINISHING: "Finishing",
  CONN_STATUS_PREPARING: "Preparing",
  CONN_STATUS_SUSPENDED_EVSE: "SuspendedEVSE",
  CONN_STATUS_SUSPENDED_EV: "SuspendedEV",
  CONN_STATUS_UNAVAILABLE: "Unavailable",

  STATS_GROUP_BY_CONSUMPTION: "C",
  STATS_GROUP_BY_USAGE: "U",

  ENTITY_SITE: "Site",
  ENTITY_SITES: "Sites",
  ENTITY_SITE_AREA: "SiteArea",
  ENTITY_SITE_AREAS: "SiteAreas",
  ENTITY_COMPANY: "Company",
  ENTITY_COMPANIES: "Companies",
  ENTITY_CHARGING_STATION: "ChargingStation",
  ENTITY_CHARGING_STATIONS: "ChargingStations",
  ENTITY_TENANT: "Tenant",
  ENTITY_TENANTS: "Tenants",
  ENTITY_TRANSACTION: "Transaction",
  ENTITY_TRANSACTIONS: "Transactions",
  ENTITY_TRANSACTION_METER_VALUES: "MeterValues",
  ENTITY_TRANSACTION_STOP: "Stop",
  ENTITY_USER: "User",
  ENTITY_USERS: "Users",
  ENTITY_VEHICLE_MANUFACTURER: "VehicleManufacturer",
  ENTITY_VEHICLE_MANUFACTURERS: "VehicleManufacturers",
  ENTITY_VEHICLES: "Vehicles",
  ENTITY_VEHICLE: "Vehicle",
  ENTITY_LOGGINGS: "Loggings",
  ENTITY_LOGGING: "Logging",
  ENTITY_PRICING: "Pricing",
  ENTITY_SETTING: "Setting",
  ENTITY_SETTINGS: "Settings",
  ENTITY_OCPI_ENDPOINT: "OcpiEndpoint",
  ENTITY_OCPI_ENDPOINTS: "OcpiEndpoints",
  ENTITY_CONNECTION: "Connection",
  ENTITY_CONNECTIONS: "Connections",


  NOTIF_TYPE_CHARGING_STATION_CONFIGURATION: "Configuration",

  NO_LIMIT: 0,

  CENTRAL_SERVER: "Central Server",

  WITH_CHARGING_STATIONS: true,
  WITHOUT_CHARGING_STATIONS: false,
  WITH_SITE: true,
  WITHOUT_SITE: false,

  VEHICLE_TYPE_CAR: 'C',

  // Statuses
  USER_STATUS_PENDING: 'P',
  USER_STATUS_ACTIVE: 'A',
  USER_STATUS_DELETED: 'D',
  USER_STATUS_INACTIVE: 'I',
  USER_STATUS_BLOCKED: 'B',
  USER_STATUS_LOCKED: 'L',

  // Roles
  ROLE_SUPER_ADMIN: "S",
  ROLE_ADMIN: "A",
  ROLE_BASIC: "B",
  ROLE_DEMO: "D",

  ACTION_READ: "Read",
  ACTION_CREATE: "Create",
  ACTION_UPDATE: "Update",
  ACTION_DELETE: "Delete",
  ACTION_LOGOUT: "Logout",
  ACTION_LIST: "List",
  ACTION_RESET: "Reset",
  ACTION_AUTHORIZE: "Authorize",
  ACTION_CLEAR_CACHE: "ClearCache",
  ACTION_DATA_TRANSFER: "DataTransfer",
  ACTION_REMOTE_STOP_TRANSACTION: "RemoteStopTransaction",
  ACTION_REMOTE_START_TRANSACTION: "RemoteStartTransaction",
  ACTION_REFUND_TRANSACTION: "RefundTransaction",
  ACTION_UNLOCK_CONNECTOR: "UnlockConnector",
  ACTION_GET_CONFIGURATION: "GetConfiguration",
  ACTION_PING: "Ping",
  ACTION_SEND_EVSE_STATUSES: "SendEVSEStatuses",
  ACTION_REGISTER: "Register",
  ACTION_GENERATE_LOCAL_TOKEN: "GenerateLocalToken",

  // Password constants
  PWD_MIN_LENGTH: 15,
  PWD_MAX_LENGTH: 20,
  PWD_UPPERCASE_MIN_COUNT: 1,
  PWD_LOWERCASE_MIN_COUNT: 1,
  PWD_NUMBER_MIN_COUNT: 1,
  PWD_SPECIAL_MIN_COUNT: 1,

  PWD_UPPERCASE_RE: /([A-Z])/g,
  PWD_LOWERCASE_RE: /([a-z])/g,
  PWD_NUMBER_RE: /([\d])/g,
  PWD_SPECIAL_CHAR_RE: /([!#$%^&*.?-])/g,

  DEFAULT_LOCALE: 'en_US',

  ANONIMIZED_VALUE: '####',

  DEFAULT_DB_LIMIT: 100,

  SETTING_PRICING_CONTENT_TYPE_SIMPLE: 'simple',
  SETTING_PRICING_CONTENT_TYPE_CONVERGENT_CHARGING: 'convergentCharging',
  SETTING_REFUND_CONTENT_TYPE_CONCUR: 'concur',

  METER_VALUE_CTX_SAMPLE_PERIODIC: 'Sample.Periodic',
  METER_VALUE_CTX_SAMPLE_CLOCK: 'Sample.Clock',
  METER_VALUE_FORMAT_RAW: 'Raw',
  METER_VALUE_MEASURAND_IMPREG: 'Energy.Active.Import.Register',
  METER_VALUE_LOCATION_OUTLET: 'Outlet',
  METER_VALUE_UNIT_WH: 'Wh',

  CHARGER_VENDOR_EBEE: 'Bender GmbH Co. KG',
  CHARGER_VENDOR_SCHNEIDER: 'Schneider Electric',
  CHARGER_VENDOR_ABB: 'ABB',

  WS_DEFAULT_KEEPALIVE: 30, // Seconds
  WS_RECONNECT_DISABLED: 0,
  WS_RECONNECT_UNLIMITED: -1,
  WS_DEFAULT_RECONNECT_MAX_RETRIES: -1,
  WS_DEFAULT_RECONNECT_TIMEOUT: 30, // Seconds
  WS_UNSUPPORTED_DATA: 1007,

  OCPP_SOCKET_TIMEOUT: 30000, // 30 sec
  OCPP_JSON_CALL_MESSAGE: 2, // Client-to-Server
  OCPP_JSON_CALL_RESULT_MESSAGE: 3, // Server-to-Client
  OCPP_JSON_CALL_ERROR_MESSAGE: 4, // Server-to-Client
  // Requested Action is not known by receiver
  OCPP_ERROR_NOT_IMPLEMENTED: 'NotImplemented',
  // Requested Action is recognized but not supported by the receiver
  OCPP_ERROR_NOT_SUPPORTED: 'NotSupported',
  // An internal error occurred and the receiver was not able to process the requested Action successfully
  OCPP_ERROR_INTERNAL_ERROR: 'InternalError',
  // Payload for Action is incomplete
  OCPP_ERROR_PROTOCOL_ERROR: 'ProtocolError',
  // During the processing of Action a security issue occurred preventing receiver from completing the Action successfully
  OCPP_ERROR_SECURITY_ERROR: 'SecurityError',
  // Payload for Action is syntactically incorrect or not conform the PDU structure for Action
  OCPP_ERROR_FORMATION_VIOLATION: 'FormationViolation',
  // Payload is syntactically correct but at least one field contains an invalid value
  OCPP_ERROR_PROPERTY_RAINT_VIOLATION: 'PropertyraintViolation',
  // Payload for Action is syntactically correct but at least one of the fields violates occurence raints
  OCPP_ERROR_OCCURENCE_RAINT_VIOLATION: 'OccurenceraintViolation',
  // Payload for Action is syntactically correct but at least one of the fields violates data type raints (e.g. "somestring": 12)
  OCPP_ERROR_TYPERAINT_VIOLATION: 'TyperaintViolation',
  // Any other error not covered by the previous ones
  OCPP_ERROR_GENERIC_ERROR: 'GenericError',

  OCPP_RESPONSE_ACCEPTED: 'Accepted',

  OCPP_PROTOCOL_JSON: 'json',
  OCPP_PROTOCOL_SOAP: 'soap',
  OCPP_VERSION_12: '1.2',
  OCPP_VERSION_15: '1.5',
  OCPP_VERSION_16: '1.6',
  OCPP_VERSION_20: '2.0',

  MAX_DATE: new Date('9999-12-31Z23:59:59:999'),
  MIN_DATE: new Date('1970-01-01Z00:00:00:000'),

  // --------------------------------------------------------------------
  // OCPI Constants
  // --------------------------------------------------------------------
  // OCPI Base Path
  OCPI_SERVER_BASE_PATH: '/ocpi/cpo/versions',
  // OCPI Available Response Status
  OCPI_STATUS_CODE: {
    // 1*** SUCCESS
    CODE_1000_SUCCESS: { status_code: 1000, status_message: "Success" },

    // 2*** CLIENT ERROR
    CODE_2000_GENERIC_CLIENT_ERROR: { status_code: 2000, status_message: "Generic Client Error" },
    CODE_2001_INVALID_PARAMETER_ERROR: { status_code: 2001, status_message: "Invalid or Missing Parameters" },
    CODE_2002_NOT_ENOUGH_INFORMATION_ERROR: { status_code: 2002, status_message: "Not enough information" },
    CODE_2003_UNKNOW_LOCATION_ERROR: { status_code: 2003, status_message: "Unknown Location" },

    // 3*** SERVER ERROR
    CODE_3000_GENERIC_SERVER_ERROR: { status_code: 3000, status_message: "Generic Server Error" },
    CODE_3001_UNABLE_TO_USE_CLIENT_API_ERROR: { status_code: 3001, status_message: "Unable to Use Client API" },
    CODE_3002_UNSUPPORTED_VERSION_ERROR: { status_code: 3002, status_message: "Unsupported Version" },
    CODE_3003_NO_MATCHING_ENDPOINTS_ERROR: { status_code: 3003, status_message: "No Matching Endpoints" }
  },

  // OCPI EVSE STATUS
  EVSE_STATUS: {
    AVAILABLE: "AVAILABLE",
    BLOCKED: "BLOCKED",
    CHARGING: "CHARGING",
    INOPERATIVE: "INOPERATIVE",
    OUTOFORDER: "OUTOFORDER",
    PLANNED: "PLANNED",
    REMOVED: "REMOVED",
    RESERVED: "RESERVED",
    UNKNOWN: "UNKNOWN"
  },


  // OCPI CONNECTOR POWER TYPE
  CONNECTOR_POWER_TYPE: {
    AC_1_PHASE: "AC_1_PHASE",
    AC_3_PHASE: "AC_3_PHASE",
    DC: "DC"
  },

  // CONNECTOR TYPE
  MAPPING_CONNECTOR_TYPE: {
    "C": "CHADEMO",
    "T2": "IEC_62196_T2",
    "CCS": "IEC_62196_T2_COMBO"
  },

  CONNECTOR_TYPES: {
    "UNKNOWN": "U",
    "CHADEMO": "C",
    "IEC_62196_T2": "T2",
    "IEC_62196_T2_COMBO": "CCS",
    "DOMESTIC": "D",
    "TYPE_1": "T1",
    "TYPE_1_CCS": "T1CCS",
    "TYPE_3C": "T3C",
  },

  // Components
  COMPONENTS: {
    OCPI: "ocpi",
    REFUND: "refund",
    PRICING: "pricing",
    ORGANIZATION: "organization",
    ANALYTICS: "analytics"
  },

  // Ocpi Registering status
  OCPI_REGISTERING_STATUS: {
    OCPI_NEW: "new",
    OCPI_REGISTERED: "registered",
    OCPI_UNREGISTERED: "unregistered"
  }
};
