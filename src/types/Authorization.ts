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
  action: Action | Action[];
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
  CAR = 'Car',
  CARS = 'Cars',
  INVOICE = 'Invoice',
  INVOICES = 'Invoices',
  TAXES = 'Taxes',
  REGISTRATION_TOKEN = 'RegistrationToken',
  REGISTRATION_TOKENS = 'RegistrationTokens'
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
  CLEAR_CACHE = 'ClearCache',
  GET_CONFIGURATION = 'GetConfiguration',
  CHANGE_CONFIGURATION = 'ChangeConfiguration',
  SYNCHRONIZE_CAR_CATALOGS = 'SynchronizeCarCatalogs',
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
  SYNCHRONIZE_INVOICES = 'SynchronizeInvoices',
  CHECK_CONNECTION = 'CheckConnection',
  PING = 'Ping',
  GENERATE_LOCAL_TOKEN = 'GenerateLocalToken',
  REGISTER = 'Register',
  TRIGGER_JOB = 'TriggerJob',
  DOWNLOAD = 'Download',
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
