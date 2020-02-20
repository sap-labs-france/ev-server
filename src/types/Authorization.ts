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
  VEHICLE_MANUFACTURER = 'VehicleManufacturer',
  VEHICLE_MANUFACTURERS = 'VehicleManufacturers',
  VEHICLES = 'Vehicles',
  VEHICLE = 'Vehicle',
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
}

export enum Role {
  SUPER_ADMIN = 'S',
  ADMIN = 'A',
  BASIC = 'B',
  DEMO = 'D',
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
  GET_CHARGING_PROFILE = 'GetChargingProfile',
  PING = 'Ping',
  TRIGGER_JOB = 'TriggerJob',
  REGISTER = 'Register',
  REGISTER_USER = 'RegisterUser',
  GENERATE_LOCAL_TOKEN = 'GenerateLocalToken',
  CHECK_CONNECTION_BILLING = 'CheckBillingConnection',
  SYNCHRONIZE_BILLING = 'SynchronizeUsersBilling',
  BILLING_TRANSACTION = 'BillingTransaction',
  READ_BILLING_TAXES = 'ReadBillingTaxes',
  POWER_LIMITATION = 'PowerLimitation',
  SET_CHARGING_PROFILE = 'SetChargingProfile',
  EXPORT_PARAMS = 'ExportParams',
  RESEND_VERIFICATION_MAIL = 'ResendVerificationEmail',
  END_USER_LICENSE_AGREEMENT = 'EndUserLicenseAgreement',
  CHECK_END_USER_LICENSE_AGREEMENT = 'CheckEndUserLicenseAgreement',
  VERIFY_EMAIL = 'VerifyEmail',
  FIRMWARE_DOWNLOAD = 'FirmwareDownload',

  OCPI_GET_LOCATIONS = 'OCPIGetLocations',
  OCPI_PATCH_LOCATIONS = 'OCPIPatchLocations',

  OCPP_SERVICE = 'OCPPService',

  WS_CONNECTION = 'WSConnection',

  BOOT_NOTIFICATION = 'BootNotification',

  ADD_CHARGING_STATION_TO_SITE_AREA = 'AddChargingStationsToSiteArea',

  REFUND = 'Refund',

  CHANGE_CONFIGURATION = 'ChangeConfiguration',

  USER_INVOICE = 'UserInvoice',

  BILLING = 'Billing',

  MONGO_DB = 'MongoDB',

  EMPTY_ACTION = '',
  DELETE_CREDENTIALS = 'DELETE credentials',
  OCPI_POST_CREDENTIALS = 'OcpiPostCredentials',
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
}
