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
  BUILDING = 'Building',
  BUILDINGS = 'Buildings',
  CAR = 'Car',
  CARS = 'Cars',
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
  AUTHORIZE = 'Authorize',
  DATA_TRANSFER = 'DataTransfer',
  STOP_TRANSACTION = 'StopTransaction',
  UPDATE_TRANSACTION = 'UpdateTransaction',
  START_TRANSACTION = 'StartTransaction',
  REFUND_TRANSACTION = 'RefundTransaction',
  GET_CONNECTOR_CURRENT_LIMIT = 'GetConnectorCurrentLimit',
  PING = 'Ping',
  TRIGGER_JOB = 'TriggerJob',
  REGISTER = 'Register',
  REGISTER_USER = 'RegisterUser',
  GENERATE_LOCAL_TOKEN = 'GenerateLocalToken',
  SYNCHRONIZE_CARS = 'SynchronizeCars',
  POWER_LIMITATION = 'ChargingStationLimitPower',
  CHARGING_PROFILE_DELETE = 'ChargingProfileDelete',
  CHARGING_PROFILE_UPDATE = 'ChargingProfileUpdate',
  OCPP_PARAM_UPDATE = 'OCPPParamUpdate',
  EXPORT_PARAMS = 'ExportParams',
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

  CLEAR_CACHE = 'ClearCache',
  GET_CONFIGURATION = 'GetConfiguration',
  CHANGE_CONFIGURATION = 'ChangeConfiguration',
  REMOTE_STOP_TRANSACTION = 'RemoteStopTransaction',
  REMOTE_START_TRANSACTION = 'RemoteStartTransaction',
  UNLOCK_CONNECTOR = 'UnlockConnector',
  RESET = 'Reset',
  SET_CHARGING_PROFILE = 'SetChargingProfile',
  GET_COMPOSITE_SCHEDULE = 'GetCompositeSchedule',
  CLEAR_CHARGING_PROFILE = 'ClearChargingProfile',
  GET_DIAGNOSTICS = 'GetDiagnostics',
  CHANGE_AVAILABILITY = 'ChangeAvailability',
  UPDATE_FIRMWARE = 'UpdateFirmware',

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

  CAR_SYNCHRONIZATION_FAILED = 'CarSynchronizationFailed',
  CAR_SYNCHRONIZATION = 'CarSynchronization',

  SESSION_NOT_STARTED_AFTER_AUTHORIZE = 'SessionNotStartedAfterAuthorize',

  UPDATE_CHARGING_STATION_WITH_TEMPLATE = 'UpdateChargingStationWithTemplate',
  UPDATE_CHARGING_STATION_TEMPLATES = 'UpdateChargingStationTemplates',

  MIGRATION = 'Migration',

  SESSION_HASH_SERVICE = 'SessionHashService',

  CLEANUP_TRANSACTION = 'CleanupTransaction',

  DIAGNOSTICS_STATUS_NOTIFICATION = 'DiagnosticsStatusNotification',

  FIRMWARE_STATUS_NOTIFICATION = 'FirmwareStatusNotification',

  ADD_CHARGING_STATION_TO_SITE_AREA = 'AddChargingStationsToSiteArea',

  ADD_BUILDING_TO_SITE_AREA = 'AddBuildingsToSiteArea',

  REFUND = 'Refund',

  USER_READ = 'UserRead',
  USER_INVOICE = 'UserInvoice',
  USER_CREATE = 'UserCreate',
  USER_DELETE = 'UserDelete',
  USER_UPDATE = 'UserUpdate',

  BILLING = 'Billing',
  BILLING_SYNCHRONIZE = 'BillingSynchronizeUsers',
  BILLING_FORCE_SYNCHRONIZE = 'BillingForceSynchronizeUser',
  BILLING_CHECK_CONNECTION = 'BillingCheckConnection',
  BILLING_TRANSACTION = 'BillingTransaction',
  BILLING_SEND_INVOICE = 'BillingSendInvoice',
  BILLING_GET_OPENED_INVOICE = 'BillingGetOpenedInvoice',
  BILLING_CREATE_INVOICE = 'BillingCreateInvoice',
  BILLING_CREATE_INVOICE_ITEM = 'BillingCreateInvoiceItem',

  MONGO_DB = 'MongoDB',

  EMPTY_ACTION = '',

  CHECK_AND_APPLY_SMART_CHARGING = 'CheckAndApplySmartCharging',
  SMART_CHARGING = 'SmartCharging',
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
  building?: string;
  buildings?: string[];
}
