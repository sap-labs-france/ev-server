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


  OCPI_AUTHORIZE_TOKEN = 'OCPIAuthorizeToken',
  OCPI_GET_LOCATIONS = 'OCPIGetLocations',
  OCPI_PATCH_LOCATIONS = 'OCPIPatchLocations',
  OCPI_PUSH_TOKENS = 'OCPIPushTokens',
  OCPI_PUSH_SESSIONS = 'OCPIPushSessions',
  OCPI_PULL_CDRS = 'OCPIPullCdrs',
  OCPI_PULL_LOCATIONS = 'OCPIPullLocations',
  OCPI_PULL_SESSIONS = 'OCPIPullSessions',
  OCPI_PULL_TOKENS = 'OCPIPullTokens',

  OCPP_SERVICE = 'OCPPService',

  WS_CONNECTION = 'WSConnection',

  BOOT_NOTIFICATION = 'BootNotification',

  ADD_CHARGING_STATION_TO_SITE_AREA = 'AddChargingStationsToSiteArea',

  REFUND = 'Refund',

  CHANGE_CONFIGURATION = 'ChangeConfiguration',

  USER_READ = 'UserRead',
  USER_INVOICE = 'UserInvoice',
  USER_CREATE = 'UserCreate',
  USER_DELETE = 'UserDelete',
  USER_UPDATE = 'UserUpdate',

  BILLING = 'Billing',
  SYNCHRONIZE_BILLING = 'BillingSynchronizeUsers',
  FORCE_SYNCHRONIZE_BILLING = 'BillingForceSynchronizeUser',
  CHECK_CONNECTION_BILLING = 'BillingCheckConnection',
  BILLING_TRANSACTION = 'BillingTransaction',
  BILLING_SEND_INVOICE = 'BillingSendInvoice',
  GET_OPENED_INVOICE = 'BillingGetOpenedInvoice',

  MONGO_DB = 'MongoDB',

  EMPTY_ACTION = '',
  DELETE_CREDENTIALS = 'DeleteCredentials',
  OCPI_POST_CREDENTIALS = 'OcpiPostCredentials',

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
