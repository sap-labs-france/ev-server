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
  RESET = 'Reset',
  AUTHORIZE = 'Authorize',
  CLEAR_CACHE = 'ClearCache',
  DATA_TRANSFER = 'DataTransfer',
  STOP_TRANSACTION = 'StopTransaction',
  UPDATE_TRANSACTION = 'UpdateTransaction',
  REMOTE_STOP_TRANSACTION = 'RemoteStopTransaction',
  START_TRANSACTION = 'StartTransaction',
  REMOTE_START_TRANSACTION = 'RemoteStartTransaction',
  REFUND_TRANSACTION = 'RefundTransaction',
  UNLOCK_CONNECTOR = 'UnlockConnector',
  GET_CONFIGURATION = 'GetConfiguration',
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
  GET_COMPOSITE_SCHEDULE = 'GetCompositeSchedule',
  EXPORT_PARAMS = 'ExportParams',
  RESEND_VERIFICATION_MAIL = 'ResendVerificationEmail',
  END_USER_LICENSE_AGREEMENT = 'EndUserLicenseAgreement',
  CHECK_END_USER_LICENSE_AGREEMENT = 'CheckEndUserLicenseAgreement',
  VERIFY_EMAIL = 'VerifyEmail',
  FIRMWARE_DOWNLOAD = 'FirmwareDownload',

  OCPI_REGISTER = 'OCPIRegister',
  OCPI_AUTHORIZE_TOKEN = 'OCPIAuthorizeToken',
  OCPI_GET_LOCATIONS = 'OCPIGetLocations',
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
  OCPI_POST_CREDENTIALS = 'OCPIPostCredentials',
  OCPI_DELETE_CREDENTIALS = 'OCPIDeleteCredentials',

  OCPP_SERVICE = 'OCPPService',

  HEARTBEAT = 'Heartbeat',

  STATUS_NOTIFICATION = 'StatusNotification',

  EXTRA_INACTIVITY = 'ExtraInactivity',

  CONSUMPTION = 'Consumption',

  WS_CONNECTION = 'WSConnection',

  BOOT_NOTIFICATION = 'BootNotification',

  METER_VALUES = 'MeterValues',

  NOTIFICATION = 'Notification',
  CHARGING_STATION_STATUS_ERROR = 'NotifyChargingStationStatusError',
  CHARGING_STATION_REGISTERED = 'NotifyChargingStationRegistered',
  END_OF_CHARGE = 'NotifyEndOfCharge',
  OPTIMAL_CHARGE_REACHED = 'NotifyOptimalChargeReached',
  END_OF_SESSION = 'NotifyEndOfSession',
  REQUEST_PASSWORD = 'NotifyRequestPassword',
  USER_ACCOUNT_STATUS_CHANGED = 'NotifyUserAccountStatusChanged',
  NEW_REGISTERED_USER = 'NotifyNewRegisteredUser',
  UNKNOWN_USER_BADGED = 'NotifyUnknownUserBadged',
  TRANSACTION_STARTED = 'NotifyTransactionStarted',
  VERIFICATION_EMAIL = 'NotifyVerificationEmail',
  AUTH_EMAIL_ERROR = 'NotifyAuthentificationErrorEmailServer',
  PATCH_EVSE_STATUS_ERROR = 'NotifyPatchEVSEStatusError',
  USER_ACCOUNT_INACTIVITY = 'NotifyUserAccountInactivity',
  PREPARING_SESSION_NOT_STARTED = 'NotifyPreparingSessionNotStarted',
  OFFLINE_CHARGING_STATIONS = 'NotifyOfflineChargingStations',
  BILLING_USER_SYNCHRONIZATION_FAILED = 'NotifyBillingUserSynchronizationFailed',
  CAR_SYNCHRONIZATION_FAILED = 'NotifyCarSynchronizationFailed',
  SESSION_NOT_STARTED_AFTER_AUTHORIZE = 'NotifySessionNotStartedAfterAuthorize',

  UPDATE_CHARGING_STATION_TEMPLATE = 'UpdateChargingStationTemplates',

  SESSION_HASH_SERVICE = 'SessionHashService',

  CLEANUP_TRANSACTION = 'CleanupTransaction',
  
  DIAGNOSTICS_STATUS_NOTIFICATION = 'DiagnosticsStatusNotification',

  FIRMWARE_STATUS_NOTIFICATION = 'FirmwareStatusNotification',
  
  ADD_CHARGING_STATION_TO_SITE_AREA = 'AddChargingStationsToSiteArea',

  ADD_BUILDING_TO_SITE_AREA = 'AddBuildingsToSiteArea',

  REFUND = 'Refund',

  CHANGE_CONFIGURATION = 'ChangeConfiguration',

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
  SAP_SMART_CHARGING = 'SAPSmartCharging',
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
