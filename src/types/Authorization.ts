export interface AuthorizationDefinition {
  superAdmin: {
    grants: Grant[];
    $extend?: any;
  };
  admin: {
    grants: Grant[];
    $extend?: any;
  };
  basic: {
    grants: Grant[];
    $extend?: any;
  };
  demo: {
    grants: Grant[];
    $extend?: any;
  };
  siteAdmin: {
    grants: Grant[];
    $extend?: any;
  };
  siteOwner: {
    grants: Grant[];
    $extend?: any;
  };
}

export interface Grant {
  resource: Entity;
  action: Action|Action[];
  attributes?: string[];
  args?: any;
  condition?: any;
}

export enum Entity {
  SITE = 'Site',
  SITES = 'Sites',
  SITE_AREA = 'SiteArea',
  SITE_AREAS = 'SiteAreas',
  COMPANY = 'Company',
  COMPANIES = 'Companies',
  CHARGING_STATION = 'ChargingStation',
  CHARGING_STATIONS = 'ChargingStations',
  TENANT = 'Tenant',
  TENANTS = 'Tenants',
  TRANSACTION = 'Transaction',
  TRANSACTIONS = 'Transactions',
  TRANSACTION_METER_VALUES = 'MeterValues',
  TRANSACTION_STOP = 'Stop',
  REPORT = 'Report',
  USER = 'User',
  USERS = 'Users',
  LOGGINGS = 'Loggings',
  LOGGING = 'Logging',
  PRICING = 'Pricing',
  BILLING = 'Billing',
  SETTING = 'Setting',
  SETTINGS = 'Settings',
  TOKENS = 'Tokens',
  TOKEN = 'Token',
  OCPI_ENDPOINT = 'OcpiEndpoint',
  OCPI_ENDPOINTS = 'OcpiEndpoints',
  CONNECTION = 'Connection',
  CONNECTIONS = 'Connections',
  ASSET = 'Asset',
  ASSETS = 'Assets',
  CAR_CATALOG = 'CarCatalog',
  CAR_CATALOGS = 'CarCatalogs',
  INVOICE = 'Invoice',
  INVOICES = 'Invoices',
  TAXES = 'Taxes'
}

export enum Action {
  READ = 'Read',
  CREATE = 'Create',
  UPDATE = 'Update',
  DELETE = 'Delete',
  LOGOUT = 'Logout',
  LOGIN = 'Login',
  LIST = 'List',
  SYNCHRONIZE_CAR_CATALOGS = 'SynchronizeCarCatalogs',
  RESET = 'Reset',
  CLEAR_CACHE = 'ClearCache',
  GET_CONFIGURATION = 'GetConfiguration',
  CHANGE_CONFIGURATION = 'ChangeConfiguration',
  REMOTE_START_TRANSACTION = 'RemoteStartTransaction',
  REMOTE_STOP_TRANSACTION = 'RemoteStopTransaction',
  UNLOCK_CONNECTOR = 'UnlockConnector',
  AUTHORIZE = 'Authorize',
  SET_CHARGING_PROFILE = 'SetChargingProfile',
  GET_COMPOSITE_SCHEDULE = 'GetCompositeSchedule',
  CLEAR_CHARGING_PROFILE = 'ClearChargingProfile',
  GET_DIAGNOSTICS = 'GetDiagnostics',
  UPDATE_FIRMWARE = 'UpdateFirmware',
  EXPORT_PARAMS = 'ExportParams',
  CHANGE_AVAILABILITY = 'ChangeAvailability',
  REFUND_TRANSACTION = 'RefundTransaction',
  SYNCHRONIZE_USERS = 'SynchronizeUsers',
  SYNCHRONIZE_USER = 'SynchronizeUser',
  CHECK_CONNECTION = 'CheckConnection',
  PING = 'Ping',
  GENERATE_LOCAL_TOKEN = 'GenerateLocalToken',
  REGISTER = 'Register',
  TRIGGER_JOB = 'TriggerJob',
  DOWNLOAD = 'Download',



  DATA_TRANSFER = 'DataTransfer',
  STOP_TRANSACTION = 'StopTransaction',
  UPDATE_TRANSACTION = 'UpdateTransaction',
  START_TRANSACTION = 'StartTransaction',
  GET_CONNECTOR_CURRENT_LIMIT = 'GetConnectorCurrentLimit',
  REGISTER_USER = 'RegisterUser',
  POWER_LIMITATION = 'ChargingStationLimitPower',
  CHARGING_PROFILE_DELETE = 'ChargingProfileDelete',
  CHARGING_PROFILE_UPDATE = 'ChargingProfileUpdate',
  OCPP_PARAM_UPDATE = 'OCPPParamUpdate',
  RESEND_VERIFICATION_MAIL = 'ResendVerificationEmail',
  END_USER_LICENSE_AGREEMENT = 'EndUserLicenseAgreement',
  CHECK_END_USER_LICENSE_AGREEMENT = 'CheckEndUserLicenseAgreement',
  VERIFY_EMAIL = 'VerifyEmail',
  FIRMWARE_DOWNLOAD = 'FirmwareDownload',

  OFFLINE_CHARGING_STATION = 'OfflineChargingStation',

  LOGS_CLEANUP = 'LogsCleanup',

  SCHEDULER = 'Scheduler',

  REMOTE_PUSH_NOTIFICATION = 'RemotePushNotification',
  EMAIL_NOTIFICATION = 'EmailNotification',

  SYNCHRONIZE_REFUND = 'RefundSynchronize',

  OCPI_REGISTER = 'OCPIRegister',
  OCPI_AUTHORIZE_TOKEN = 'OCPIAuthorizeToken',
  OCPI_PATCH_LOCATIONS = 'OCPIPatchLocations',
  OCPI_PATCH_STATUS = 'OCPIPatchStatus',
  OCPI_PUSH_TOKENS = 'OCPIPushTokens',
  OCPI_PUSH_SESSIONS = 'OCPIPushSessions',
  OCPI_PUSH_CDRS = 'OCPIPushCdrs',
  OCPI_PULL_CDRS = 'OCPIPullCdrs',
  OCPI_PULL_LOCATIONS = 'OCPIPullLocations',
  OCPI_PULL_SESSIONS = 'OCPIPullSessions',
  OCPI_PULL_TOKENS = 'OCPIPullTokens',
  OCPI_START_SESSION = 'OCPIStartSession',
  OCPI_STOP_SESSION = 'OCPIStopSession',
  OCPI_RESERVE_NOW = 'OCPIReserveNow',
  OCPI_UNLOCK_CONNECTOR = 'OCPIUnlockConnector',
  OCPI_GET_VERSIONS = 'OCPIGetVersions',
  OCPI_GET_LOCATIONS = 'OCPIGetLocations',
  OCPI_GET_SESSIONS = 'OCPIGetSessions',
  OCPI_GET_TOKENS = 'OCPIGetTokens',
  OCPI_GET_CDRS = 'OCPIGetCdrs',
  OCPI_POST_CREDENTIALS = 'OCPIPostCredentials',
  OCPI_DELETE_CREDENTIALS = 'OCPIDeleteCredentials',

  OCPP_SERVICE = 'OCPPService',

  AUTHORIZATIONS = 'Authorizations',

  DB_WATCH = 'DBWatch',

  EXPRESS_SERVER = 'ExpressServer',
  ODATA_SERVER = 'ODataServer',

  LOCKING = 'Locking',

  STARTUP = 'Startup',

  SOCKET_IO = 'SocketIO',

  HEARTBEAT = 'Heartbeat',

  STATUS_NOTIFICATION = 'StatusNotification',

  EXTRA_INACTIVITY = 'ExtraInactivity',

  CONSUMPTION = 'Consumption',

  WS_ERROR = 'WSError',
  WS_CLIENT_ERROR = 'WSClientError',
  WS_CLIENT_INFO = 'WSClientInfo',

  WS_CONNECTION = 'WSConnection',
  WS_JSON_CONNECTION_OPENED = 'WSJsonConnectionOpened',
  WS_JSON_CONNECTION_CLOSED = 'WSJsonConnectionClosed',

  WS_REST_CONNECTION_OPENED = 'WSRestServerConnectionOpened',
  WS_REST_CONNECTION_CLOSED = 'WSRestServerConnectionClosed',
  WS_REST_CONNECTION_ERROR = 'WSRestServerConnectionError',

  WS_REST_CLIENT_ERROR_RESPONSE = 'WSRestClientErrorResponse',
  WS_REST_CLIENT_MESSAGE = 'WSRestClientMessage',
  WS_REST_CLIENT_SEND_MESSAGE = 'WSRestClientSendMessage',
  WS_REST_CLIENT_CONNECTION_CLOSED = 'WSRestClientConnectionClosed',
  WS_REST_CLIENT_CONNECTION_OPENED = 'WSRestClientConnectionOpened',

  BOOT_NOTIFICATION = 'BootNotification',

  METER_VALUES = 'MeterValues',

  
  NOTIFICATION = 'Notification',
  CHARGING_STATION_STATUS_ERROR = 'ChargingStationStatusError',
  CHARGING_STATION_REGISTERED = 'ChargingStationRegistered',
  END_OF_CHARGE = 'EndOfCharge',
  OPTIMAL_CHARGE_REACHED = 'OptimalChargeReached',
  END_OF_SESSION = 'EndOfSession',
  REQUEST_PASSWORD = 'RequestPassword',
  USER_ACCOUNT_STATUS_CHANGED = 'UserAccountStatusChanged',
  NEW_REGISTERED_USER = 'NewRegisteredUser',
  UNKNOWN_USER_BADGED = 'UnknownUserBadged',
  TRANSACTION_STARTED = 'TransactionStarted',
  VERIFICATION_EMAIL = 'VerificationEmail',
  AUTH_EMAIL_ERROR = 'AuthentificationErrorEmailServer',
  PATCH_EVSE_STATUS_ERROR = 'PatchEVSEStatusError',
  USER_ACCOUNT_INACTIVITY = 'UserAccountInactivity',
  PREPARING_SESSION_NOT_STARTED = 'PreparingSessionNotStarted',
  OFFLINE_CHARGING_STATIONS = 'OfflineChargingStations',
  BILLING_USER_SYNCHRONIZATION_FAILED = 'BillingUserSynchronizationFailed',

  CAR_CATALOG_SYNCHRONIZATION_FAILED = 'CarCatalogSynchronizationFailed',
  CAR_CATALOG_SYNCHRONIZATION = 'CarCatalogSynchronization',

  SESSION_NOT_STARTED_AFTER_AUTHORIZE = 'SessionNotStartedAfterAuthorize',

  UPDATE_CHARGING_STATION_WITH_TEMPLATE = 'UpdateChargingStationWithTemplate',
  UPDATE_CHARGING_STATION_TEMPLATES = 'UpdateChargingStationTemplates',

  MIGRATION = 'Migration',

  SESSION_HASH_SERVICE = 'SessionHashService',

  CLEANUP_TRANSACTION = 'CleanupTransaction',

  DIAGNOSTICS_STATUS_NOTIFICATION = 'DiagnosticsStatusNotification',

  FIRMWARE_STATUS_NOTIFICATION = 'FirmwareStatusNotification',

  ADD_CHARGING_STATION_TO_SITE_AREA = 'AddChargingStationsToSiteArea',

  ADD_ASSET_TO_SITE_AREA = 'AddAssetsToSiteArea',

  REFUND = 'Refund',

  USER_READ = 'UserRead',
  USER_INVOICE = 'UserInvoice',
  USER_CREATE = 'UserCreate',
  USER_DELETE = 'UserDelete',
  USER_UPDATE = 'UserUpdate',

  BILLING = 'Billing',
  BILLING_TRANSACTION = 'BillingTransaction',
  BILLING_SEND_INVOICE = 'BillingSendInvoice',
  BILLING_CREATE_INVOICE = 'BillingCreateInvoice',
  BILLING_CREATE_INVOICE_ITEM = 'BillingCreateInvoiceItem',

  MONGO_DB = 'MongoDB',

  EMPTY_ACTION = '',

  CHECK_AND_APPLY_SMART_CHARGING = 'CheckAndApplySmartCharging',
  SMART_CHARGING = 'SmartCharging',

  IMPORT_MODULE = 'ImportModule',
}

export interface AuthorizationContext {
  tagIDs?: string[];
  tagID?: string;
  owner?: string;
  site?: string;
  sites?: string[];
  sitesAdmin?: string[];
  user?: string;
  UserID?: string;
  sitesOwner?: string[];
  company?: string;
  companies?: string[];
  asset?: string;
  assets?: string[];
}
